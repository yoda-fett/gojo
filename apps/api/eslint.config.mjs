import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '**/prisma/client*', '**/node_modules/.prisma/**'],
              message: 'Import from packages/db instead of @prisma/client directly.',
            },
            {
              group: ['**/packages/db/src/client*'],
              message: 'Use packages/db exports instead of the raw Prisma client.',
            },
          ],
        },
      ],
    },
  },
];
