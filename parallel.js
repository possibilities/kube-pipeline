const parallel = jobs => ({
  jobs,
  type: 'JobList',
  concurrency: 'parallel'
})

module.exports = parallel
