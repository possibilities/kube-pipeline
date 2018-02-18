const waitForJob = (kubernetes, job) => {
  return new Promise(resolve => {
    return kubernetes.apis.batch.v1.jobs.watch(job.metadata.name)
      .then(jobStream => {
        jobStream.on('modified', item => {
          if (item.status.completionTime) {
            jobStream.unwatch()
            resolve(!!item.status.succeeded)
          }
        })
      })
  })
}

module.exports = waitForJob
