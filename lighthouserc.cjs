module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:4175/'],
      startServerCommand: 'node scripts/servidor-rendimiento.mjs',
      startServerReadyPattern: 'Server listening',
      startServerReadyTimeout: 15000,
      numberOfRuns: 3,
      settings: { formFactor: 'mobile', onlyCategories: ['performance'] },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reportes' },
  },
};
