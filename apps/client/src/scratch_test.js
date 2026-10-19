import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { FloatingArrow } from '@floating-ui/react';

const context = {
  placement: 'top',
  middlewareData: {
    arrow: { x: 10, y: 0 }
  },
  elements: {
    floating: { offsetWidth: 100, offsetHeight: 100 }
  }
};

const html = ReactDOMServer.renderToString(
  React.createElement(FloatingArrow, {
    context: context,
    fill: 'var(--sp-tooltip-bg)',
    stroke: 'var(--sp-tooltip-border)',
    strokeWidth: 1,
    width: 12,
    height: 6,
    tipRadius: 1.5
  })
);
console.log(html);
