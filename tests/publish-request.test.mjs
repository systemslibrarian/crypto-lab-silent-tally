import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const deployWorkflow = readFileSync(join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
const testWorkflow = readFileSync(join(root, '.github', 'workflows', 'test.yml'), 'utf8');

// Replace only the external GitHub boundary; exercise the real npm script.
// Neither control dispatches a workflow or uploads any local build.
function request(exitCode) {
  const dir = mkdtempSync(join(tmpdir(), 'publish-request-control-'));
  const gh = join(dir, 'gh');
  writeFileSync(gh, '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\nprocess.exit(Number(process.env.PUBLISH_CONTROL_EXIT));\n');
  chmodSync(gh, 0o700);
  try {
    return spawnSync(npmCommand, ['run', 'deploy', '--silent'], {
      cwd: root,
      env: { ...process.env, PATH: dir + delimiter + process.env.PATH, GH_TOKEN: '', PUBLISH_CONTROL_EXIT: String(exitCode) },
      encoding: 'utf8',
      timeout: 5000,
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('publishing requests the existing gated main workflow', () => {
  const result = request(0);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout.trim()), [
    'workflow', 'run', 'deploy.yml', '--repo',
    'systemslibrarian/crypto-lab-silent-tally', '--ref', 'main',
  ]);
});

test('a rejected publishing request retains its failing exit status', () => {
  const result = request(73);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 73);
});

test('publish credentials are scoped to the deploy job', () => {
  assert.match(deployWorkflow, /^permissions:\n  contents: read\n\nconcurrency:/m);
  assert.match(
    deployWorkflow,
    /  deploy:\n[\s\S]*?    permissions:\n      pages: write\n      id-token: write\n    steps:/,
  );
  assert.match(testWorkflow, /^permissions:\n  contents: read\n\njobs:/m);

  const buildJob = deployWorkflow.match(/\n  build:\n([\s\S]*?)\n  deploy:/)?.[1] ?? '';
  assert.doesNotMatch(buildJob, /pages: write|id-token: write/);
});
