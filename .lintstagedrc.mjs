import path from 'path';
import process from 'process';

const buildEslintCommand = (filenames) => {
  // only lint files under src/
  const srcFiles = filenames.filter((f) => f.startsWith('src/'));
  if (srcFiles.length === 0) return '';
  return `eslint ${srcFiles
    .map((f) => path.relative(process.cwd(), f))
    .join(' ')}`;
};

const prettierCommand = 'prettier --write';

export default {
  '*.{js,mjs,ts,mts}': [prettierCommand, buildEslintCommand],
  '*.json': [prettierCommand],
};
