#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
};

const coveragePath = readArg('--coverage', 'coverage/ecocut-calculator/coverage-final.json');
const thresholdArg = readArg('--threshold', '99');
const perFile = args.includes('--per-file');

const threshold = Number(thresholdArg);
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
  console.error(`[coverage:check] Invalid threshold: ${thresholdArg}`);
  process.exit(1);
}

const fullCoveragePath = path.resolve(process.cwd(), coveragePath);
if (!fs.existsSync(fullCoveragePath)) {
  console.error(`[coverage:check] Coverage file not found: ${fullCoveragePath}`);
  process.exit(1);
}

const rawCoverage = fs.readFileSync(fullCoveragePath, 'utf8');
const coverageJson = JSON.parse(rawCoverage);

const emptyMetric = () => ({ covered: 0, total: 0 });
const countObjectMetric = (metricObject) => {
  const metric = emptyMetric();
  if (!metricObject) {
    return metric;
  }
  for (const value of Object.values(metricObject)) {
    metric.total += 1;
    if (value > 0) {
      metric.covered += 1;
    }
  }
  return metric;
};

const countBranchMetric = (branchObject) => {
  const metric = emptyMetric();
  if (!branchObject) {
    return metric;
  }
  for (const branchCounts of Object.values(branchObject)) {
    for (const count of branchCounts) {
      metric.total += 1;
      if (count > 0) {
        metric.covered += 1;
      }
    }
  }
  return metric;
};

const toPercent = ({ covered, total }) => {
  if (!total) {
    return 100;
  }
  return (covered / total) * 100;
};

const toRelative = (filePath) => {
  const relative = path.relative(process.cwd(), filePath);
  return relative || filePath;
};

const fileMetrics = [];
for (const [filePath, fileCoverage] of Object.entries(coverageJson)) {
  if (!filePath.endsWith('.ts')) {
    continue;
  }

  const statements = countObjectMetric(fileCoverage.s);
  const branches = countBranchMetric(fileCoverage.b);
  const functions = countObjectMetric(fileCoverage.f);
  const lines = countObjectMetric(fileCoverage.l);

  fileMetrics.push({
    filePath,
    statements,
    branches,
    functions,
    lines,
    percentages: {
      statements: toPercent(statements),
      branches: toPercent(branches),
      functions: toPercent(functions),
      lines: toPercent(lines),
    },
  });
}

if (!fileMetrics.length) {
  console.error('[coverage:check] No TypeScript files were found in the coverage report.');
  process.exit(1);
}

const totalMetrics = {
  statements: emptyMetric(),
  branches: emptyMetric(),
  functions: emptyMetric(),
  lines: emptyMetric(),
};

for (const fileMetric of fileMetrics) {
  for (const key of Object.keys(totalMetrics)) {
    totalMetrics[key].covered += fileMetric[key].covered;
    totalMetrics[key].total += fileMetric[key].total;
  }
}

const totals = {
  statements: toPercent(totalMetrics.statements),
  branches: toPercent(totalMetrics.branches),
  functions: toPercent(totalMetrics.functions),
  lines: toPercent(totalMetrics.lines),
};

const failingFiles = fileMetrics.filter(({ percentages }) => {
  return (
    percentages.statements < threshold ||
    percentages.branches < threshold ||
    percentages.functions < threshold ||
    percentages.lines < threshold
  );
});

const failingTotals = Object.entries(totals)
  .filter(([, percent]) => percent < threshold)
  .map(([key, percent]) => `${key}=${percent.toFixed(2)}%`);

if (failingTotals.length > 0) {
  console.error(
    `[coverage:check] Total coverage below ${threshold}%: ${failingTotals.join(', ')}`,
  );
}

if (perFile && failingFiles.length > 0) {
  console.error(`[coverage:check] ${failingFiles.length} files are below ${threshold}%:`);
  const sortedFailingFiles = failingFiles.sort((left, right) => {
    const leftMin = Math.min(...Object.values(left.percentages));
    const rightMin = Math.min(...Object.values(right.percentages));
    return leftMin - rightMin;
  });

  for (const metric of sortedFailingFiles) {
    const { statements, branches, functions, lines } = metric.percentages;
    console.error(
      ` - ${toRelative(metric.filePath)} (s ${statements.toFixed(2)}%, b ${branches.toFixed(2)}%, f ${functions.toFixed(2)}%, l ${lines.toFixed(2)}%)`,
    );
  }
}

if (failingTotals.length > 0 || (perFile && failingFiles.length > 0)) {
  process.exit(1);
}

console.log(
  `[coverage:check] OK (threshold ${threshold}%): s ${totals.statements.toFixed(2)}% | b ${totals.branches.toFixed(2)}% | f ${totals.functions.toFixed(2)}% | l ${totals.lines.toFixed(2)}%`,
);
