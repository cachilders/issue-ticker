const R = require('ramda');

const _recent = (itemUpdated, lastUpdated) => new Date(itemUpdated) > lastUpdated;

const prettify = issue => JSON.stringify(issue, null, 2);

const compareIssues = (prev, next) => {
  const lastUpdated = prev[0] && new Date(prev[0].updated);
  const makeReference = R.indexBy(R.prop('id'));
  const prevReference = makeReference(prev);
  const nextReference = makeReference(next);

  const getLatest = issues => issues.filter(issue => _recent(issue.updated, lastUpdated));
  const persistent = issue => !!nextReference[issue.id];
  const preexisting = issue => !!prevReference[issue.id];

  const {0: updated, 1: added} = R.partition(preexisting, getLatest(next));
  const dropped = R.reject(persistent, prev);
  
  return {added, dropped, updated};
};

module.exports = {
  compareIssues,
  prettify,
};
