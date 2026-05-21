import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const shouldKill = process.argv.includes('--kill');

function removePath(relativePath) {
  const target = path.resolve(rootDir, relativePath);
  try {
    rmSync(target, { recursive: true, force: true });
    console.log(`Removed ${relativePath}`);
  } catch (error) {
    console.warn(`Could not remove ${relativePath}: ${error.message}`);
  }
}

function runPowerShell(command) {
  spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { stdio: 'inherit' }
  );
}

function stopWindowsDevServers() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $project = (Resolve-Path -LiteralPath '${rootDir.replaceAll("'", "''")}').Path.ToLowerInvariant()
    $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
      if (-not $_.CommandLine) { return $false }
      $cmd = $_.CommandLine.ToLowerInvariant()
      ($cmd -like '*dashboard-next*' -and ($cmd -like '*next*dev*' -or $cmd -like '*start-server.js*' -or $cmd -like '*next-server*')) -or
      (($cmd -like '*node_modules*next*' -or $cmd -like '*start-server.js*') -and $cmd -like "*$project*")
    }
    $nodeProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

    $owners = Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $owners) {
      Stop-Process -Id $processId -Force
    }
  `;

  runPowerShell(script);
}

if (shouldKill && process.platform === 'win32') {
  stopWindowsDevServers();
}

removePath('.next');
removePath('node_modules/.cache');
