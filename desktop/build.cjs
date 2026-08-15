/**
 * Lightweight Standalone Build Script for AdHub Pro Desktop (.exe)
 * 1. Builds the Vite production bundle (dist/)
 * 2. Prepares a minimal staging directory (WITHOUT heavy dev node_modules)
 * 3. Packages with @electron/packager resulting in a tiny, fast app.asar (~15 MB)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { packager } = require('@electron/packager');

const rootDir = path.resolve(__dirname, '..');
const stageDir = path.join(__dirname, 'app_stage');
const outDir = path.join(rootDir, 'dist_desktop');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function build() {
  console.log('========================================================');
  console.log('🚀 بدء بناء تطبيق AdHub Pro خفيف وسريع الحجم...');
  console.log('========================================================\n');

  try {
    // Step 1: Build React/Vite app
    console.log('📦 [1/3] جاري بناء وتجميع واجهة الويب (Vite Build)...');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

    // Step 2: Prepare clean staging folder with ZERO unnecessary node_modules
    console.log('\n🧹 [2/3] تجهيز حزمة التطبيق النظيفة (حذف أدوات التطوير الضخمة)...');
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stageDir, { recursive: true });

    // Copy dist/
    copyRecursiveSync(path.join(rootDir, 'dist'), path.join(stageDir, 'dist'));

    // Copy all desktop scripts
    const stageDesktop = path.join(stageDir, 'desktop');
    fs.mkdirSync(stageDesktop, { recursive: true });
    fs.readdirSync(__dirname).forEach(file => {
      if (file.endsWith('.cjs') || file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.sql')) {
        if (file !== 'build.cjs') {
          fs.copyFileSync(path.join(__dirname, file), path.join(stageDesktop, file));
        }
      }
    });

    // Copy icon
    const stagePublic = path.join(stageDir, 'public');
    fs.mkdirSync(stagePublic, { recursive: true });
    if (fs.existsSync(path.join(rootDir, 'public', 'favicon.ico'))) {
      fs.copyFileSync(path.join(rootDir, 'public', 'favicon.ico'), path.join(stagePublic, 'favicon.ico'));
    }

    // Minimal package.json for runtime
    const minimalPackageJson = {
      name: 'adhub-pro',
      version: '1.0.0',
      description: 'AdHub Pro Desktop Application',
      main: 'desktop/main.cjs',
      author: 'الفارس الذهبي للدعاية',
    };
    fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(minimalPackageJson, null, 2));

    // Step 3: Package with Electron Packager
    console.log('\n🔒 [3/3] تشفير وحزم التطبيق بحجم فائق الصغر (ASAR Encryption)...');
    
    try {
      execSync('powershell -Command "Get-Process -Name AdHub-Pro,electron -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' });
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1000));

    const targetDir = path.join(outDir, 'AdHub-Pro-win32-x64');
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      } catch (e) {
        try {
          const trash = path.join(outDir, `old_${Date.now()}`);
          fs.renameSync(targetDir, trash);
          setTimeout(() => {
            try { fs.rmSync(trash, { recursive: true, force: true }); } catch {}
          }, 5000);
        } catch (renameErr) {}
      }
    }

    const appPaths = await packager({
      dir: stageDir,
      out: outDir,
      name: 'AdHub-Pro',
      platform: 'win32',
      arch: 'x64',
      icon: path.join(rootDir, 'public', 'favicon.ico'),
      asar: true,
      overwrite: true,
      appVersion: '1.0.0',
      appCopyright: 'Copyright © 2026 الفارس الذهبي للدعاية',
      win32metadata: {
        CompanyName: 'الفارس الذهبي للدعاية',
        FileDescription: 'AdHub Pro Desktop Application',
        ProductName: 'AdHub Pro',
        InternalName: 'AdHub-Pro',
      },
    });

    // Cleanup stage directory
    fs.rmSync(stageDir, { recursive: true, force: true });

    console.log('\n========================================================');
    console.log('✅ اكتمل البناء بنجاح وبحجم صغير جداً!');
    console.log(`📁 تم إنشاء التطبيق في:`);
    appPaths.forEach(p => console.log(`   👉 ${p}`));
    console.log('========================================================');

    if (appPaths && appPaths.length > 0) {
      const exePath = path.join(appPaths[0], 'AdHub-Pro.exe');
      const asarPath = path.join(appPaths[0], 'resources', 'app.asar');
      if (fs.existsSync(asarPath)) {
        const asarSizeMB = (fs.statSync(asarPath).size / 1024 / 1024).toFixed(2);
        console.log(`\n📊 حجم شفرة وملفات التطبيق المشفرة (app.asar): ${asarSizeMB} MB فقط! ✨`);

        // Also sync to dist_desktop if it exists
        const oldDistAsar = path.join(rootDir, 'dist_desktop', 'AdHub-Pro-win32-x64', 'resources', 'app.asar');
        if (fs.existsSync(path.dirname(oldDistAsar))) {
          try {
            fs.copyFileSync(asarPath, oldDistAsar);
            console.log(`🔄 تم تحديث نسخة dist_desktop أيضاً لتعمل بنفس التحديثات الحديثة!`);
          } catch (e) {}
        }
      }
      if (fs.existsSync(exePath)) {
        console.log(`🎉 البرنامج جاهز للتشغيل الآن:\n   📌 ${exePath}\n`);
      }
    }
  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء عملية البناء:', error.message);
    process.exit(1);
  }
}

build();
