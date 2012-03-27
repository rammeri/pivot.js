var pivot = (function(){
  var fields      = {},
      filters     = {},
      rawData     = [],
      data        = [],
      dataFilters = {};

  //*******************************
  // CSV Processing
  //*******************************
  function processCSV(text) {
    var header;
    rawData = processRows(text, function(row, i) {
      if (i > 0) {
        var o = {}, j = -1, m = header.length;
        while (++j < m) {
          var value = castFieldValue(header[j], row[j]);

          o[header[j]] = value;

          addFieldValue(header[j], value);
        };
        return o;
      } else {
        header = row;
        return null;
      }
    });
  };

  function processRows(text, f) {
    var EOL = {}, // sentinel value for end-of-line
        EOF = {}, // sentinel value for end-of-file
        rows = [], // output rows
        re = /\r\n|[,\r\n]/g, // field separator regex
        n = 0, // the current line number
        t, // the current token
        eol; // is the current token followed by EOL?

    re.lastIndex = 0; // work-around bug in FF 3.6

    /** @private Returns the next token. */
    function token() {
      if (re.lastIndex >= text.length) return EOF; // special case: end of file
      if (eol) { eol = false; return EOL; } // special case: end of line

      // special case: quotes
      var j = re.lastIndex;
      if (text.charCodeAt(j) === 34) {
        var i = j;
        while (i++ < text.length) {
          if (text.charCodeAt(i) === 34) {
            if (text.charCodeAt(i + 1) !== 34) break;
            i++;
          }
        }
        re.lastIndex = i + 2;
        var c = text.charCodeAt(i + 1);
        if (c === 13) {
          eol = true;
          if (text.charCodeAt(i + 2) === 10) re.lastIndex++;
        } else if (c === 10) {
          eol = true;
        }
        return text.substring(j + 1, i).replace(/""/g, "\"");
      }

      // common case
      var m = re.exec(text);
      if (m) {
        eol = m[0].charCodeAt(0) !== 44;
        return text.substring(j, m.index);
      }
      re.lastIndex = text.length;
      return text.substring(j);
    }

    while ((t = token()) !== EOF) {
      var a = [];
      while ((t !== EOL) && (t !== EOF)) {
        a.push(t);
        t = token();
      }
      if (f && !(a = f(a, n++))) continue;
      rows.push(a);
    }

    return rows;
  };

  //*******************************
  // Filtering
  //*******************************
  function pivotFilters(){
    return {
      all:    filters,
      set:    setFilters,
      apply:  applyFilter,
    }
  };

  function setFilters(restrictions){
    filters = restrictions;
  };

  function applyFilter(restrictions){
    var dataToFilter    = data,
        filteredData    = [],
        preserveFilter  = preserveFilteredData();

    if (restrictions !== undefined) filters = restrictions;

    if (preserveFilter) {
      dataToFilter = data;
    } else {
      dataToFilter = rawData;
    }

    var dataToFilterLength = dataToFilter.length,
        filterLength = Object.keys(filters).length;

    for (var i = 0; i < dataToFilterLength; i++) {
      var row     = dataToFilter[i],
          matches = 0;

      for (var key in filters) {
        if (filters.hasOwnProperty(key) && row.hasOwnProperty(key) && row[key] === filters[key])
          matches += 1;
      }

      if (matches == filterLength) {
        filteredData.push(row);
      };
    };

    data = filteredData;
    setDataFilters();
    return data;
  };

  function setDataFilters(){
    dataFilters = {};

    for (var key in filters) {
      if (filters.hasOwnProperty(key))
        dataFilters[key] = filters[key];
    }
  };

  function preserveFilteredData(){
    var matches = 0,
        dataFiltersLength = Object.keys(dataFilters).length;

    for (var key in dataFilters) {
      if (dataFilters.hasOwnProperty(key) && dataFilters.hasOwnProperty(key) && filters[field] === dataFilters[key])
        matches += 1;
    }

    return dataFiltersLength > 0 && matches >= dataFiltersLength;
  };

  //*******************************
  // Fields
  //*******************************
  function pivotFields(){
    return {
      all:          getFields,
      set:          setFields,
      filterable:   restrictFields('filterable'),
      summarizable: restrictFields('summarizable'),
      pseudo:       restrictFields('pseudo'),
      detail:       restrictFields('detail'),
      get:          getField,
      add:          appendField
    }
  };

  function setFields(listing){
    fields = {};
    for (var i = 0; i < listing.length; i++) {
      appendField(listing[i]);
    }
  };

  function getFields(){
    var retFields = [];
    for (var key in fields) {
      if (fields.hasOwnProperty(key)) retFields.push(fields[key]);
    }

    return retFields;
  };

  function restrictFields(type){
    var retFields = [];
    for (var key in fields) {
      if (fields.hasOwnProperty(key) && fields[key][type] === true) retFields.push(fields[key]);
    }

    return retFields;
  };

  function getField(name){
    return fields[name];
  };

  function appendField(field){
    // if field is a simple string setup and object with that string as a name
    if (Object.prototype.toString.call(field) === '[object String]') field = {name: field};

    if (field.type          === undefined) field.type          = 'String';
    if (field.pseudo        === undefined) field.pseudo        = false;
    if (field.detail        === undefined) field.detail        = true;
    if (field.filterable    === undefined) field.filterable    = false;
    if (field.summarizable  === undefined) field.summarizable  = false;
    if (field.summarizable && field.summarizable_function == undefined)
        field.summarize_function = function(rows){ rows.length };

    field.values = {};

    fields[field.name] = field;

    return field;
  };

  function addFieldValue(field, value){
    if (fields[field] === undefined || fields[field].filterable === false) return;

    if (fields[field].values[value] === undefined)
      fields[field].values[value] = 0;
    else
      fields[field].values[value] += 1;
  };

  function castFieldValue(fieldName, value){
    if (Object.prototype.toString.call(fieldName) === '[object String]') field = fields[fieldName];
    if (field === undefined) field = appendField(fieldName);

    switch (field.type){
      case "integer":
        return parseInt(value, 10);
      case "float":
        return parseFloat(value, 10);
      case "date":
        return new Date(value);
      default:
        return value.toString();
    }
  };

  //*******************************
  // Data
  //*******************************
  function pivotData(){
    return {
      raw: rawData,
      all: data
    }
  }

  return {
    csv:      processCSV,
    data:     pivotData,
    fields:   pivotFields,
    filters:  pivotFilters
  }
})();