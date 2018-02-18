const last = require('lodash/last')
const padStart = require('lodash/padStart')
const initial = require('lodash/initial')
const uuid = require('uuid/v4')
const configureDebug = require('debug')

const debug = configureDebug('kube-pipeline')
const workerImage = 'node:8.9.4-alpine'

const jobToContainer = (job, id, index, srcPath) => {
  const name = `step-${index + 1}`

  if (job.type === 'JobList') {
    return {
      name,
      image: workerImage,
      env: [
        {
          name: 'payload',
          value: JSON.stringify({ list: job, id, srcPath })
        },
        {
          name: 'POD_NAMESPACE',
          valueFrom: {
            fieldRef: {
              fieldPath: 'metadata.namespace'
            }
          }
        }
      ],
      volumeMounts: [{ name: 'app-source', mountPath: '/src' }],
      command: ['node'],
      args: ['/src/worker.js']
    }
  }

  return {
    name,
    image: job.image,
    command: ['/bin/sh', '-c'],
    args: [job.tasks.join(' && ')]
  }
}

const containersForJobList = (list, id, srcPath) => {
  if (list.concurrency === 'parallel') {
    return {
      containers: list.jobs.map((job, index) => jobToContainer(job, id, index, srcPath))
    }
  }

  const initJobs = initial(list.jobs)
  const lastJob = last(list.jobs)

  return {
    initContainers: initJobs.map((job, index) => jobToContainer(job, id, index, srcPath)),
    containers: [jobToContainer(lastJob, id, initJobs.length, srcPath)]
  }
}

const addListIndices = list => {
  let index = list.index || 1

  const buildIndices = list => ({
    ...list,
    jobs: list.jobs.map(job => {
      if (job.type === 'JobList') {
        index = index + 1
        return buildIndices({ ...job, index })
      }
      return job
    })
  })

  return { index, ...buildIndices(list) }
}

const runJobs = async (kubernetes, list, id, srcPath = __dirname) => {
  const isRoot = !id
  id = id || uuid()
  list = isRoot ? addListIndices(list) : list
  const { index, jobs, concurrency } = list
  debug('running x%s jobs in %s', jobs.length, concurrency)

  const jobId = `worker-${id}`
  const name = `${jobId}-${padStart(index, 4, '0')}-${concurrency[0]}`
  const heritage = 'kube-pipeline'

  const metadata = {
    name,
    labels: { name, jobId, heritage, concurrency, position: isRoot ? 'root' : 'sub' },
    annotations: { pipelineData: JSON.stringify({ list }) }
  }

  return kubernetes.apis.batch.v1.jobs.create({
    metadata,
    spec: {
      backoffLimit: 0,
      template: {
        metadata,
        spec: {
          ...containersForJobList(list, id, srcPath),
          volumes: [ { name: 'app-source', hostPath: { path: srcPath } } ],
          restartPolicy: 'Never'
        }
      }
    }
  })
}

module.exports = runJobs
