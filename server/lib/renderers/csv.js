/**
 * @overview lib/renderers/csv
 *
 * @description
 * This library is used to render CSV data from UI-Grids.  The user experience
 * will be similar to using the print to pdf renderers, except it will allow
 * downloading as a comma separated file to the client.
 *
 * @requires q
 * @requires lodash
 * @requires json2csv
 * @requires moment
 * @requires debug
 */

const _ = require('lodash');
const converter = require('json-2-csv');
const moment = require('moment');
const debug = require('debug')('renderer:csv');

// @TODO discuss if this should be moved into its own library
const DATE_FORMAT = 'DD/MM/YYYY H:mm:s';

const headers = {
  'Content-Type' : 'text/csv',
};

// CSV rendering defaults
const defaults = {
  trimHeaderFields : true,
};

const ID_KEYWORDS = ['_id', 'uuid'];

// this field will tell the csv renderer what to render
const DEFAULT_DATA_KEY = 'csv';

exports.extension = '.csv';
exports.render = renderCSV;
exports.headers = headers;

/**
 * Render a csv file`
 * @param {object} data - Object of keys/values for the data
 * @param {string} template - Path to a handlebars template
 * @param {object} options - The default options to be extended and passed to renderer
 * @returns {Promise} Promise resolving in a rendered dataset (CSV)
 */
function renderCSV(data, template, options = {}) {

  // allow different server routes to pass in csvOptions
  const csvOptions = _.defaults(options.csvOptions, defaults);

  // Force addition of the excel BOM to enable the output file to be treated
  // as UTF-8 so language-specific UTF-8 characters, accents, etc, are retained
  csvOptions.excelBOM = true;

  let csvData = data[options.csvKey || DEFAULT_DATA_KEY];

  debug(`processing a CSV of ${csvData.length} rows.`);

  if (!options.suppressDefaultFormatting) {
    debug('applying default date formatting.');
    csvData = csvData.map(dateFormatter);
  }

  if (!options.suppressDefaultFiltering) {
    // row based filters
    csvData = csvData.map(idFilter);

    // data set based filters
    csvData = emptyFilter(csvData);
    debug('applying default row filtering.');
  }

  // render the data array csv as needed
  return converter.json2csv(csvData, csvOptions);
}

// converts a value to a date string if it is a date
const convertIfDate = (csvValue) => {
  if (_.isDate(csvValue)) {
    return moment(csvValue).format(DATE_FORMAT);
  }

  return csvValue;
};

/**
 * @method dateFormatter
 *
 * @description
 * Accepts an object of key/value pairs. Returns the same object with all values
 * that are dates converted to a standard format.
 */
function dateFormatter(csvRow) {
  // utility function that accepts the value of a CSV date column and converts to a standard format
  return _.mapValues(csvRow, convertIfDate);
}

/**
 * @function containsIdKeyword
 *
 * @private
 *
 * @description
 * Accepts in a columnName and returns true if it is included in the
 * list of reserved identifiers
 */
function containsIdKeyword(columnName) {
  return ID_KEYWORDS.some((keyword) => columnName.includes(keyword));
}

/**
 * @method idFilter
 *
 * @description
 * Accepts an object of key/ value pairs. Returns a manipulated object, removing
 * all columns that match a pre-defined list of keywords
 */
function idFilter(csvRow) {
  const invalidColumns = _.keys(csvRow).filter(containsIdKeyword);

  invalidColumns.forEach((columnName) => delete csvRow[columnName]);
  return csvRow;
}

/**
 * @method emptyFilter
 *
 * @description
 * Accepts an array of CSV object rows. This method removes attributes from each
 * row if that attribute is NULL for every value in the array.
 */
function emptyFilter(csvData) {
  if (_.isEmpty(csvData)) { return []; }

  const firstElement = csvData[0];

  // assumes all rows have exactly the same columns
  const invalidColumns = _.keys(firstElement).filter(columnIsEmpty);

  function columnIsEmpty(columnName) {
    // this will return true as soon as any of the values in the rows are not NULL
    // if it returns true we return false (!true) to ensure this row is kept
    return !csvData.some((csvRow) => !_.isNil(csvRow[columnName]));
  }

  return csvData.map((csvRow) => {
    invalidColumns.forEach((columnName) => delete csvRow[columnName]);
    return csvRow;
  });
}
