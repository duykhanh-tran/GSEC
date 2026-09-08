import taskCatalog from '../src/app/task-catalog.json' with { type: 'json' }

export const ALL_TASK_CODES = taskCatalog.map(({ code }) => code)
export const MIGRATED_TASK_CODES = taskCatalog
  .filter(({ status }) => status === 'migrated')
  .map(({ code }) => code)
