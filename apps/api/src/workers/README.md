# Worker Conventions

Every BullMQ worker introduced in later epics should register a Sentry failure hook:

```ts
worker.on('failed', (job, err) => {
  Sentry.captureException(err, {
    extra: {
      jobId: job?.id,
    },
  });
});
```
