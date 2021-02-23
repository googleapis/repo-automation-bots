exports['check for config should validate if config is correct yaml 1'] = {
  name: 'YAMLException',
  reason: 'bad indentation of a mapping entry',
  mark: {
    name: null,
    buffer:
      'rules:\n- title: value\n      author: "/regex/"\n- author: "/regex/"\n auhor:\n',
    position: 34,
    line: 2,
    column: 12,
    snippet:
      ' 1 | rules:\n 2 | - title: value\n 3 |       author: "/regex/"\n-----------------^\n 4 | - author: "/regex/"\n 5 |  auhor:',
  },
  message:
    'bad indentation of a mapping entry (3:13)\n\n 1 | rules:\n 2 | - title: value\n 3 |       author: "/regex/"\n-----------------^\n 4 | - author: "/regex/"\n 5 |  auhor:',
};

exports['check for config should return false if YAML is invalid 1'] = false;

exports[
  'check for config should return error message if YAML is invalid 1'
] = false;
