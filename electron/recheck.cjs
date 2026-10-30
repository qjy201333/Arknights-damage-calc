const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.commandLine.appendSwitch('disable-gpu')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: false })
  await win.loadFile(path.join(__dirname, '../dist/index.html'))
  await new Promise((r) => setTimeout(r, 1200))
  await win.webContents.executeJavaScript("document.querySelector('.op-list li').click()")
  await new Promise((r) => setTimeout(r, 500))
  await win.webContents.executeJavaScript("document.querySelector('.relic-config summary').click()")
  await new Promise((r) => setTimeout(r, 400))
  await win.webContents.executeJavaScript(`(() => {
    const labels = [...document.querySelectorAll('.relic-picker label')];
    const target = labels.find((l) => l.textContent.includes('生命蓝图'));
    target.querySelector('input[type=checkbox]').click();
  })()`)
  await new Promise((r) => setTimeout(r, 500))
  const before = await win.webContents.executeJavaScript("document.querySelectorAll('.result-row')[5]?.innerText.replace(/\n/g,'=')")
  await win.webContents.executeJavaScript(`(() => {
    const labels = [...document.querySelectorAll('.relic-picker label')];
    labels.find((l) => l.textContent.includes('生命蓝图')).querySelector('.cond-toggle').click();
  })()`)
  await new Promise((r) => setTimeout(r, 600))
  const after = await win.webContents.executeJavaScript("document.querySelectorAll('.result-row')[5]?.innerText.replace(/\n/g,'=')")
  console.log('BEFORE:', before, '| AFTER:', after)
  app.quit()
})
