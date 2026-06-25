export default {
  '*.{js,mjs,ts,mts,json}': (filenames) =>
    `yarn ultracite fix ${filenames.map((filename) => JSON.stringify(filename)).join(' ')}`,
  '*.ts': () => 'yarn type-check',
};
