import {
  getRequirementsStatus,
  installRequirement,
  installRequirements,
  isRequirementId,
  type RequirementId,
  type RequirementInstallResult,
  type RequirementStatus
} from './runtimeRequirements.js';

type StatusPayload = {
  command: 'status';
  ok: true;
  requirements: RequirementStatus[];
};

type InstallPayload = {
  command: 'install';
  target: RequirementId | 'all';
  ok: boolean;
  results: RequirementInstallResult[];
};

function printUsage(): void {
  console.log('Usage:');
  console.log('  tsx src/main/requirements/cli.ts status');
  console.log('  tsx src/main/requirements/cli.ts install opencode');
  console.log('  tsx src/main/requirements/cli.ts install arduino-cli');
  console.log('  tsx src/main/requirements/cli.ts install all');
}

function printStatus(requirements: RequirementStatus[]): void {
  console.log('Requirements status:');
  for (const requirement of requirements) {
    const status = requirement.installed ? 'Installed' : 'Not installed';
    const version = requirement.version ?? 'Not found';
    console.log(`- ${requirement.label}: ${status} (${version})`);
    if (requirement.details && !requirement.installed) {
      console.log(`  detail: ${requirement.details}`);
    }
  }
}

function printInstallResults(results: RequirementInstallResult[]): void {
  for (const result of results) {
    console.log(`- ${result.id}: ${result.ok ? 'OK' : 'FAILED'}`);
    console.log(`  message: ${result.message}`);
    if (result.versionAfter) {
      console.log(`  version: ${result.versionAfter}`);
    }
    if (!result.ok && result.manualCommands.length > 0) {
      console.log('  manual commands:');
      for (const command of result.manualCommands) {
        console.log(`    ${command}`);
      }
    }
  }
}

function printJsonLine(payload: StatusPayload | InstallPayload): void {
  console.log(JSON.stringify(payload));
}

async function run(): Promise<number> {
  const [command, target] = process.argv.slice(2);

  if (command === 'status') {
    const requirements = await getRequirementsStatus();
    printStatus(requirements);
    printJsonLine({
      command: 'status',
      ok: true,
      requirements
    });
    return 0;
  }

  if (command === 'install') {
    if (!target) {
      printUsage();
      return 1;
    }

    if (target === 'all') {
      const results = await installRequirements(['opencode', 'arduino-cli']);
      const ok = results.every((item) => item.ok);
      printInstallResults(results);
      printJsonLine({
        command: 'install',
        target: 'all',
        ok,
        results
      });
      return ok ? 0 : 1;
    }

    if (!isRequirementId(target)) {
      printUsage();
      return 1;
    }

    const result = await installRequirement(target);
    printInstallResults([result]);
    printJsonLine({
      command: 'install',
      target,
      ok: result.ok,
      results: [result]
    });
    return result.ok ? 0 : 1;
  }

  printUsage();
  return 1;
}

void run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
