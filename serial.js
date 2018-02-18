const serial = jobs => ({
  jobs,
  type: 'JobList',
  concurrency: 'serial'
})

module.exports = serial
