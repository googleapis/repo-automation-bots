exports[
  'failurechecker opens an issue on GitHub if there exists a pending label > threshold 1'
] = {
  title: 'Warning: a recent release failed',
  body: 'The release PR #33 is still in a pending state after several hours',
  labels: ['type: process'],
};

exports[
  'failurechecker opens an issue on GitHub if there exists a tagged label > threshold 1'
] = {
  title: 'Warning: a recent release failed',
  body: 'The release PR #33 is still in a pending state after several hours',
  labels: ['type: process'],
};
