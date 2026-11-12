/**
 * electron-builder afterPack 钩子：
 * better-sqlite3 v13 自带各平台 N-API 预编译产物（prebuilds/*.node，无需 node-gyp 编译），
 * 打包后把非当前平台的 .node 删掉，避免每个安装包多背 ~20MB 无用二进制。
 */
const fs = require('node:fs')
const path = require('node:path')

const ARCH_NAME = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' }

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName // 'darwin' | 'win32' | 'linux'
  const arch = ARCH_NAME[context.arch] || 'x64'
  const keep = `${platform}-${arch}`

  const resources =
    platform === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources')

  const prebuildsDir = path.join(resources, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'prebuilds')
  if (!fs.existsSync(prebuildsDir)) {
    console.log('[afterPack] 未找到 better-sqlite3 prebuilds 目录，跳过裁剪')
    return
  }

  let removed = 0
  for (const file of fs.readdirSync(prebuildsDir)) {
    const target = path.join(prebuildsDir, file)
    if (file !== `${keep}.node` && fs.statSync(target).isFile()) {
      fs.unlinkSync(target)
      removed += 1
    }
  }
  console.log(`[afterPack] 保留 ${keep}.node，删除 ${removed} 个其他平台预编译产物`)
}
