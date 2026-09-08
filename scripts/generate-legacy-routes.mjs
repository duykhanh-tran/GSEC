import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = process.cwd()
const distRoot = join(projectRoot, 'dist')
const appHtml = await readFile(join(distRoot, 'index.html'), 'utf8')
const taskCatalog = JSON.parse(await readFile(join(projectRoot, 'src', 'app', 'task-catalog.json'), 'utf8'))
const taskCodes = taskCatalog.map(({ code }) => code).sort()
if (!taskCodes.length || taskCodes.some((code) => !/^\d{5}$/.test(code)) || new Set(taskCodes).size !== taskCodes.length) {
  throw new Error('Task catalog must contain unique five-digit task codes.')
}

const canonicalizeTaskPath = `<script>
    (() => {
      const match = window.location.pathname.match(/^\\/tasks\\/(\\d{5})(?:\\/|\\/index\\.html)$/)
      if (match) window.history.replaceState(null, '', '/tasks/' + match[1] + window.location.search + window.location.hash)
    })()
  </script>`
const taskHtml = appHtml.replace('<head>', `<head>\n  ${canonicalizeTaskPath}`)

for (const code of taskCodes) {
  const taskDirectory = join(distRoot, 'tasks', code)
  await mkdir(taskDirectory, { recursive: true })
  await writeFile(join(taskDirectory, 'index.html'), taskHtml, 'utf8')
}

await writeFile(join(distRoot, '404.html'), appHtml, 'utf8')
console.log(`Generated ${taskCodes.length} static task entry points and dist/404.html.`)
