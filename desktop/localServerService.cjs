/**
 * Local Supabase & Docker Server Management Service for AdHub Pro
 * Automates:
 * 1. Detecting & Launching Docker Desktop on Windows
 * 2. Initializing & Starting local Supabase containers (supabase start)
 * 3. Checking server health on http://127.0.0.1:54321 and PostgreSQL on 54322
 * 4. Automatic background detection and startup in Offline Mode
 */

const { exec, spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const DOCKER_SEARCH_PATHS = [
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
  'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Docker', 'Docker', 'Docker Desktop.exe'),
];

const LOCAL_SUPABASE_DIR = path.join(os.homedir(), 'adhub_local_supabase');
const DEFAULT_LOCAL_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

/**
 * Finds Docker Desktop executable path
 */
function findDockerDesktopPath() {
  for (const p of DOCKER_SEARCH_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Checks if Docker Daemon is running
 */
function isDockerRunning() {
  try {
    execSync('docker ps', { stdio: 'ignore', timeout: 3500 });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if Supabase Local API is alive on port 54321
 */
function isSupabaseApiAlive() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:54321/rest/v1/', { timeout: 2500 }, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Starts Docker Desktop on Windows and waits for it to become ready
 */
async function ensureDockerRunning(onProgress = () => {}) {
  if (isDockerRunning()) {
    onProgress({ stage: 'docker', percent: 25, message: 'محرك Docker يعمل في الخلفية بنجاح ✅' });
    return true;
  }

  const dockerPath = findDockerDesktopPath();
  if (dockerPath) {
    onProgress({ stage: 'docker', percent: 10, message: 'جاري تشغيل برنامج Docker Desktop في الخلفية...' });
    try {
      exec(`cmd /c start "" "${dockerPath}"`);
    } catch (err) {
      console.error('Failed to launch Docker Desktop:', err);
    }

    // Wait up to 60 seconds for Docker daemon to become responsive
    const maxRetries = 25;
    for (let i = 1; i <= maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      onProgress({
        stage: 'docker',
        percent: 10 + Math.round((i / maxRetries) * 35),
        message: `في انتظار استجابة محرك Docker (${i * 2.5} ثانية)...`,
      });
      if (isDockerRunning()) {
        onProgress({ stage: 'docker', percent: 45, message: 'تم تشغيل محرك Docker بنجاح ✅' });
        return true;
      }
    }
  }

  throw new Error('تعذر بدء تشغيل Docker Desktop تلقائياً. يرجى فتح برنامج Docker Desktop يدوياً.');
}

/**
 * Ensures a local supabase project directory exists and is initialized
 */
function ensureSupabaseInitialized(onProgress = () => {}) {
  if (!fs.existsSync(LOCAL_SUPABASE_DIR)) {
    fs.mkdirSync(LOCAL_SUPABASE_DIR, { recursive: true });
  }

  const configPath = path.join(LOCAL_SUPABASE_DIR, 'supabase', 'config.toml');
  if (!fs.existsSync(configPath)) {
    onProgress({ stage: 'init', percent: 48, message: 'جاري تهيئة إعدادات Supabase المحلية...' });
    try {
      execSync('supabase init --yes', { cwd: LOCAL_SUPABASE_DIR, stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      console.warn('supabase init warning:', e.message);
    }
  }
}

/**
 * Starts the local Supabase containers (supabase start)
 */
async function startLocalSupabaseStack(onProgress = () => {}) {
  // 1. Check if Supabase is already alive
  const alreadyAlive = await isSupabaseApiAlive();
  if (alreadyAlive) {
    onProgress({ stage: 'complete', percent: 100, message: 'سيرفر Supabase المحلي متصل ويعمل بنجاح (http://127.0.0.1:54321) ✅' });
    return {
      success: true,
      url: 'http://127.0.0.1:54321',
      anonKey: DEFAULT_LOCAL_KEY,
      alreadyRunning: true,
    };
  }

  // 2. Check/Start Docker
  await ensureDockerRunning(onProgress);

  // 3. Initialize supabase if needed
  ensureSupabaseInitialized(onProgress);

  // 4. Run supabase start
  onProgress({ stage: 'starting', percent: 50, message: 'جاري تشغيل حاويات Supabase المحلية (PostgreSQL 54322, PostgREST 54321)...' });

  return new Promise((resolve, reject) => {
    let completed = false;

    // Periodic health check every 2 seconds to finish as soon as API is ready
    const healthInterval = setInterval(async () => {
      if (completed) return;
      const isUp = await isSupabaseApiAlive();
      if (isUp) {
        completed = true;
        clearInterval(healthInterval);
        onProgress({ stage: 'complete', percent: 100, message: 'تم تشغيل سيرفر Supabase المحلي بنجاح (http://127.0.0.1:54321) ✅' });
        resolve({
          success: true,
          url: 'http://127.0.0.1:54321',
          anonKey: DEFAULT_LOCAL_KEY,
          wasStarted: true,
        });
      }
    }, 2000);

    const child = spawn('supabase', ['start'], {
      cwd: LOCAL_SUPABASE_DIR,
      shell: true,
    });

    let currentPercent = 50;

    child.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        if (msg.includes('Downloading') || msg.includes('Pulling') || msg.includes('Extracting')) {
          if (currentPercent < 85) currentPercent += 2;
          onProgress({ stage: 'downloading', percent: currentPercent, message: `جاري تنزيل صور Docker للسيرفر المحلي (${currentPercent}%)...` });
        } else if (msg.includes('Starting') || msg.includes('Started') || msg.includes('Configuring')) {
          currentPercent = Math.max(currentPercent, 88);
          onProgress({ stage: 'starting', percent: currentPercent, message: `جاري بدء تشغيل الخدمات: ${msg.slice(0, 60)}` });
        } else {
          onProgress({ stage: 'starting', percent: currentPercent, message: msg.slice(0, 80) });
        }
      }
    });

    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && (msg.includes('Downloading') || msg.includes('Pulling') || msg.includes('Extracting'))) {
        if (currentPercent < 85) currentPercent += 2;
        onProgress({ stage: 'downloading', percent: currentPercent, message: `جاري تنزيل صور Docker للسيرفر المحلي (${currentPercent}%)...` });
      }
    });

    child.on('close', async (code) => {
      if (completed) return;
      clearInterval(healthInterval);

      const isAliveNow = await isSupabaseApiAlive();
      if (code === 0 || isAliveNow) {
        completed = true;
        onProgress({ stage: 'complete', percent: 100, message: 'تم تشغيل سيرفر Supabase المحلي بنجاح (http://127.0.0.1:54321) ✅' });
        resolve({
          success: true,
          url: 'http://127.0.0.1:54321',
          anonKey: DEFAULT_LOCAL_KEY,
          wasStarted: true,
        });
      } else {
        reject(new Error(`فشل تشغيل سيرفر Supabase المحلي (كود الخروج: ${code})`));
      }
    });

    child.on('error', (err) => {
      if (completed) return;
      clearInterval(healthInterval);
      reject(err);
    });
  });
}

/**
 * Ensures the local stack is running (auto-detects and auto-starts if offline)
 */
async function ensureLocalStackRunning(onProgress = () => {}) {
  const isAlive = await isSupabaseApiAlive();
  if (isAlive) {
    const isDocker = isDockerRunning();
    return {
      success: true,
      dockerRunning: isDocker,
      supabaseRunning: true,
      alreadyRunning: true,
    };
  }

  try {
    const result = await startLocalSupabaseStack(onProgress);
    return {
      ...result,
      dockerRunning: true,
      supabaseRunning: true,
    };
  } catch (err) {
    return {
      success: false,
      dockerRunning: isDockerRunning(),
      supabaseRunning: false,
      error: err.message,
    };
  }
}

/**
 * Stops local Supabase containers
 */
async function stopLocalSupabaseStack(onProgress = () => {}) {
  onProgress({ stage: 'stopping', percent: 50, message: 'جاري إيقاف سيرفر Supabase المحلي...' });
  return new Promise((resolve) => {
    try {
      execSync('supabase stop', { cwd: LOCAL_SUPABASE_DIR, stdio: 'ignore', timeout: 30000 });
      onProgress({ stage: 'stopped', percent: 100, message: 'تم إيقاف السيرفر المحلي بنجاح' });
      resolve({ success: true });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

/**
 * Checks overall local stack status
 */
async function getLocalStackStatus() {
  const docker = isDockerRunning();
  const apiAlive = await isSupabaseApiAlive();
  return {
    dockerRunning: docker,
    supabaseRunning: apiAlive,
    url: 'http://127.0.0.1:54321',
    localDir: LOCAL_SUPABASE_DIR,
  };
}

module.exports = {
  isDockerRunning,
  isSupabaseApiAlive,
  startLocalSupabaseStack,
  stopLocalSupabaseStack,
  ensureLocalStackRunning,
  getLocalStackStatus,
};
