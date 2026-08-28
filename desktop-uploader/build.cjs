/**
 * Build Script for Standalone Google Drive Uploader Desktop App (.exe)
 * Packages into a lightweight, fast, portable Windows executable with embedded Google Drive Icon
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { packager } = require('@electron/packager');
const { rcedit } = require('rcedit');

const rootDir = path.resolve(__dirname, '..');
const uploaderDir = __dirname;
const stageDir = path.join(uploaderDir, 'stage_build');
const outDir = path.join(rootDir, 'dist_desktop');

async function buildUploader() {
  console.log('========================================================');
  console.log('🚀 بدء بناء تطبيق رافع ملفات Google Drive المستقل (.exe)...');
  console.log('========================================================\n');

  try {
    // 1. Prepare clean staging directory
    console.log('🧹 [1/3] تجهيز الملفات وحزمة التطبيق...');
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stageDir, { recursive: true });

    // Copy app files
    fs.copyFileSync(path.join(uploaderDir, 'main.cjs'), path.join(stageDir, 'main.cjs'));
    fs.copyFileSync(path.join(uploaderDir, 'preload.cjs'), path.join(stageDir, 'preload.cjs'));
    fs.copyFileSync(path.join(uploaderDir, 'index.html'), path.join(stageDir, 'index.html'));
    fs.copyFileSync(path.join(uploaderDir, 'styles.css'), path.join(stageDir, 'styles.css'));
    fs.copyFileSync(path.join(uploaderDir, 'app.js'), path.join(stageDir, 'app.js'));

    // Copy Google Drive icons
    const driveIconIco = path.join(uploaderDir, 'drive_icon.ico');
    const driveIconPng = path.join(uploaderDir, 'drive_icon.png');
    if (fs.existsSync(driveIconIco)) {
      fs.copyFileSync(driveIconIco, path.join(stageDir, 'drive_icon.ico'));
    }
    if (fs.existsSync(driveIconPng)) {
      fs.copyFileSync(driveIconPng, path.join(stageDir, 'drive_icon.png'));
    }

    // Minimal package.json
    const minimalPackageJson = {
      name: 'google-drive-uploader',
      version: '1.0.0',
      description: 'Google Drive Standalone File & Image Uploader',
      main: 'main.cjs',
      author: 'Google Drive Uploader',
    };
    fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(minimalPackageJson, null, 2));

    // 2. Packaging with Electron Packager
    console.log('\n📦 [2/3] بناء التطبيق وتشفير الحزمة بصيغة ASAR...');

    try {
      execSync('powershell -Command "Get-Process -Name Google-Drive-Uploader,AdHub-Drive-Uploader,electron -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' });
    } catch (e) {}

    await new Promise(r => setTimeout(r, 1000));

    const targetDir = path.join(outDir, 'Google-Drive-Uploader-win32-x64');
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      } catch (e) {
        try {
          const trash = path.join(outDir, `old_uploader_${Date.now()}`);
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
      name: 'Google-Drive-Uploader',
      platform: 'win32',
      arch: 'x64',
      icon: driveIconIco,
      asar: true,
      overwrite: true,
      appVersion: '1.0.0',
      appCopyright: 'Copyright © 2026 Google Drive Uploader',
      win32metadata: {
        CompanyName: 'Google Drive Uploader',
        FileDescription: 'Google Drive File & Image Direct Uploader',
        ProductName: 'Google Drive Uploader',
        InternalName: 'Google-Drive-Uploader',
      },
    });

    // 3. Explicitly inject and stamp the Google Drive icon into the .exe using rcedit
    if (appPaths && appPaths.length > 0) {
      const exePath = path.join(appPaths[0], 'Google-Drive-Uploader.exe');
      if (fs.existsSync(exePath)) {
        console.log('\n🎨 [3/3] تثبيت أيقونة Google Drive في ملف .exe عبر rcedit...');
        await rcedit(exePath, {
          icon: driveIconIco,
          'file-version': '1.0.0',
          'product-version': '1.0.0',
          'version-string': {
            CompanyName: 'Google Drive Uploader',
            FileDescription: 'Google Drive File & Image Direct Uploader',
            ProductName: 'Google Drive Uploader',
            LegalCopyright: 'Copyright © 2026 Google Drive Uploader',
          }
        });
        console.log('✅ تم دمج أيقونة Google Drive بنجاح داخل رأس ملف .exe!');
      }
    }

    // Clean up staging
    fs.rmSync(stageDir, { recursive: true, force: true });

    console.log('\n========================================================');
    console.log('✅ اكتمل بناء تطبيق رافع ملفات Google Drive بنجاح!');
    console.log('📁 مسار التطبيق التنفيذي (.exe):');
    appPaths.forEach(p => console.log(`   👉 ${p}`));
    console.log('========================================================');

    if (appPaths && appPaths.length > 0) {
      const exePath = path.join(appPaths[0], 'Google-Drive-Uploader.exe');
      if (fs.existsSync(exePath)) {
        console.log(`\n🎉 ملف التشغيل المباشر بالأيقونة المحدثة جاهز:\n   📌 ${exePath}\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء عملية بناء التطبيق:', error.message);
    process.exit(1);
  }
}

buildUploader();
