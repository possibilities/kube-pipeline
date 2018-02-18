const configureKubernetes = require('kube-client')
const findConfig = require('kube-client/findConfig')
const runJobs = require('./runJobs')
const waitForJob = require('./waitForJob')

const run = async () => {
  try {
    if (!process.env.payload) {
      console.error(`process.env.payload is required to run a worker`)
      process.exit(1)
    }

    const { list, id, srcPath } = JSON.parse(process.env.payload)

    const config = await findConfig()
    const kubernetes = await configureKubernetes({
      ...config,
      namespace: process.env.POD_NAMESPACE
    })

    const job = await runJobs(kubernetes, list, id, srcPath)
    await waitForJob(kubernetes, job)

    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

run()
