#!/usr/bin/env node

var fs = require('fs');
var Handlebars = require('handlebars');
var marked = require('marked');
var moment = require('moment');
var severityMap = {low: 0, medium: 1, high: 2};

module.exports = {run: run };

function metadataForVuln(vuln) {
  return {
    id: vuln.id,
    title: vuln.title,
    name: vuln.name,
    info: vuln.info || 'No information available.',
    severity: vuln.severity,
    severityValue: severityMap[vuln.severity],
    description: vuln.description || 'No description available.',
  };
}

function groupVulns(vulns) {
  var result = {};
  if (!vulns || typeof vulns.length === 'undefined') {
    return result;
  }
  for (var i = 0; i < vulns.length; i++) {
    if (!result[vulns[i].id]) {
      result[vulns[i].id] = {};
      result[vulns[i].id].list = [];
      result[vulns[i].id].metadata = metadataForVuln(vulns[i]);
    }
    result[vulns[i].id].list.push(vulns[i]);
  }
  return result;
}

function generateTemplate(data, template) {
  data.vulnerabilities = groupVulns(data.vulnerabilities);
  var htmlTemplate = fs.readFileSync(template, 'utf8');
  return Handlebars.compile(htmlTemplate)(data);
}

function onDataCallback(data, template, reportCallback) {
  try {
    data = JSON.parse(data);
  } catch (error) {
    console.log('Error: Invalid input JSON format, aborting process.');
    return;
  }
  var report = generateTemplate(data, template);
  reportCallback(report);
}

function readInputFromFile(source, template, reportCallback) {
  fs.readFile(source, 'utf8', function (err, data) {
    if (err) {
      throw err;
    }
    onDataCallback(data, template, reportCallback);
  });
}

function readInputFromStdin(template, reportCallback) {
  var data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('readable', function () {
    var chunk = process.stdin.read();
    if (chunk !== null) {
      data += chunk;
    }
  });
  process.stdin.on('end', function () {
    onDataCallback(data, template, reportCallback);
  });
}

function run(source, template, reportCallback) {
  try {
    if (source) {
      readInputFromFile(source, template, reportCallback);
    } else {
      readInputFromStdin(template, reportCallback);
    }
  } catch (error) {
    console.log('out');
  }
}

// handlebar helpers
Handlebars.registerHelper('markdown', function (source) {
  return marked(source);
});

Handlebars.registerHelper('moment', function (date, format) {
  return moment.utc(date).format(format);
});

Handlebars.registerHelper('isDoubleArray', function (data, options) {
  return Array.isArray(data[0]) ? options.fn(data) : options.inverse(data);
});

Handlebars.registerHelper('if_eq', function (a, b, opts) {
  return (a === b) ? opts.fn(this) : opts.inverse(this);
});

Handlebars.registerHelper('count', function (data) {
  return data && data.length;
});

Handlebars.registerHelper('dump', function (data, spacer) {
  return JSON.stringify(data, null, spacer || null);
});

Handlebars.registerHelper('if_any', function () { // important: not an arrow fn
  var args = [].slice.call(arguments);
  var opts = args.pop();

  return args.some(function (v) {return !!v;}) ?
    opts.fn(this) :
    opts.inverse(this);
});

Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
  switch (operator) {
    case '==': {
      return (v1 == v2) ? options.fn(this) // jshint ignore:line
                        : options.inverse(this);
    }
    case '===': {
      return (v1 === v2) ? options.fn(this) : options.inverse(this);
    }
    case '<': {
      return (v1 < v2) ? options.fn(this) : options.inverse(this);
    }
    case '<=': {
      return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    }
    case '>': {
      return (v1 > v2) ? options.fn(this) : options.inverse(this);
    }
    case '>=': {
      return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    }
    case '&&': {
      return (v1 && v2) ? options.fn(this) : options.inverse(this);
    }
    case '||': {
      return (v1 || v2) ? options.fn(this) : options.inverse(this);
    }
    default: {
      return options.inverse(this);
    }
  }
});
