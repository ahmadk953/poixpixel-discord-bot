export default {
  '*.{js,mjs,ts,mts,json}': (filenames) =>
    `yarn ultracite fix ${filenames.join(' ')}`,
  '*.ts': 'yarn type-check',
};
