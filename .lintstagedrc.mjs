import path from 'path';
import process from 'process';

const buildEslintCommand = (filenames) =>
  `eslint ${filenames.map((f) => path.relative(process.cwd(), f))}`;

const prettierCommand = 'prettier --write';

export default {
  '*.{js,mjs,ts,mts}': [prettierCommand, buildEslintCommand],
  '*.{json}': [prettierCommand],
};
