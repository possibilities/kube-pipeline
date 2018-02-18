const configureKubernetes = require('kube-client')
const startProxy = require('kube-client/startProxy')
const waitForJob = require('./waitForJob')
const get = require('lodash/get')

const job = require('./job')
const serial = require('./serial')
const parallel = require('./parallel')
const runJobs = require('./runJobs')

// TODO real tests

const run = async () => {
  try {
    const proxy = await startProxy()
    const kubernetes = await configureKubernetes({
      ...proxy.config,
      namespace: 'default'
    })

    const job1 = job(
      'job 1',
      'alpine',
      [
        'sleep 1',
        'echo job 1, task 1',
        'echo job 1, task 2'
      ]
    )

    const job2 = job(
      'job 2',
      'alpine',
      [
        'sleep 2',
        'echo job 2, task 1',
        'echo job 2, task 2'
      ]
    )

    const job3 = job(
      'job 3',
      'alpine',
      [
        'sleep 1',
        'echo job 3, task 1',
        'echo job 3, task 2',
        'echo job 3, task 3'
      ]
    )

    const pipelineJob = await runJobs(
      kubernetes,
      serial([
        job1,
        job2,
        parallel([
          job1,
          job2,
          serial([
            job1,
            job2,
            job3
          ])
        ]),
        job3
      ])
    )

    console.info('Running pipeline...')

    const { jobId } = pipelineJob.metadata.labels
    const pipeline = await kubernetes.apis.batch.v1.jobs.watch({
      labelSelector: `jobId=${jobId}`
    })

    pipeline.on('added', job => {
      const containers = get(job, 'spec.template.spec.containers', [])
      const initContainers = get(job, 'spec.template.spec.initContainers', [])
      const allContainers = [...containers, ...initContainers]
      const id = job.metadata.name.split('-')[6]
      console.info(`Job ${id} added with x${allContainers.length} ${job.metadata.labels.concurrency} steps`)
    })

    await waitForJob(kubernetes, pipelineJob)
    proxy.disconnect()
  } catch (error) {
    console.error(error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

run()
