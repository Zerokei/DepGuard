import { quantize } from 'd3-interpolate';
import { scaleOrdinal } from 'd3-scale';
import { interpolateSpectral } from 'd3-scale-chromatic';
import { select } from 'd3-selection';
import { arc, pie } from 'd3-shape';
import React, { useEffect, useRef } from 'react';
import { useColorize, useExcludes, useIncludeDev } from './App';
import { Toggle } from './Components';
import { hslFor } from './Graph';
import { Pane, Section, Tag, Tags } from './Inspector';
import { Person } from './types';
import { simplur } from './util';
import '/css/HistoryPane.scss';
import History from "./History";

function PieGraph({ entries, ...props }) {
  const svgEl = useRef();
  useEffect(() => {
    // Chart code from https://observablehq.com/@d3/pie-chart

    const svg = select(svgEl.current);

    // Align SVG view box to actual element dimensions
    const { width, height } = svg.node().getBoundingClientRect();
    const w2 = width / 2,
      h2 = height / 2;
    const radius = Math.min(w2, h2);
    svg.attr('viewBox', `${-w2} ${-h2} ${width} ${height}`);

    // Create arcs
    const arcs = pie()
      .value(e => e[1])
      .sort(null)(entries);

    // Create colors
    const color = scaleOrdinal()
      .domain(entries.map(e => e[0]))
      .range(
        quantize(
          t => interpolateSpectral(t * 0.8 + 0.1),
          entries.length
        ).reverse()
      );

    // Render arcs
    svg
      .append('g')
      .attr('stroke', 'white')
      .selectAll('path')
      .data(arcs)
      .join('path')
      .attr('fill', e => color(e.data[0]))
      .attr(
        'd',
        arc()
          .innerRadius(radius / 2)
          .outerRadius(radius)
      )
      .append('title')
      .text(d => `${d.data[0]}: ${d.data[1].toLocaleString()}`);

    // Render labels
    const arcLabel = arc()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);
    svg
      .append('g')
      .attr('font-family', 'sans-serif')
      .attr('text-anchor', 'middle')
      .attr('fill', 'black')
      .selectAll('text')
      .data(arcs)
      .join('text')
      .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
      .attr(
        'font-size',
        d => `${0.75 + (d.endAngle - d.startAngle) / Math.PI / 2}em`
      )
      .call(text =>
        text
          .append('tspan')
          .attr('y', '-0.4em')
          .text(d => d.data[0])
      )
      .call(text =>
        text
          .filter(d => d.endAngle - d.startAngle > 0.25)
          .append('tspan')
          .attr('x', 0)
          .attr('y', '0.7em')
          .attr('fill-opacity', 0.5)
          .text(d => d.data[1].toLocaleString())
      );
  });

  return <svg ref={svgEl} {...props} />;
}

export default function HistoryPane({ history: history, ...props }) {
  // const compareEntryKey = ([a]: [string, unknown], [b]: [string, unknown]) =>
  //   a < b ? -1 : a > b ? 1 : 0;
  // const compareEntryValue = ([, a], [, b]) => (a < b ? -1 : a > b ? 1 : 0);
  // const [colorize, setColorize] = useColorize();
  // const [excludes] = useExcludes();
  // const [includeDev, setIncludeDev] = useIncludeDev();
  //
  // if (!history?.modules) return <div>Loading</div>;
  //
  // const occurances = {};
  // const maintainers: { [key: string]: Person & { count?: number } } = {};
  // const licenseCounts: { [key: string]: number } = {};
  // for (const [
  //   ,
  //   {
  //     module: { package: pkg, licenseString: license },
  //   },
  // ] of history.modules) {
  //   // Tally module occurances
  //   occurances[pkg.name] = (occurances[pkg.name] || 0) + 1;
  //
  //   // Tally maintainers
  //   for (const { name, email } of pkg.maintainers) {
  //     if (!maintainers[name]) {
  //       maintainers[name] = { name, email, count: 1 };
  //     } else {
  //       maintainers[name].count++;
  //     }
  //   }
  //
  //   // Tally licenses
  //   licenseCounts[license] = (licenseCounts[license] || 0) + 1;
  // }
  //
  // const licenses = Object.entries(licenseCounts)
  //   .sort(compareEntryValue)
  //   .reverse();

  return (
    <Pane {...props}>


      <Section title='Module History'>

        <div
          style={{
            fontSize: '90%',
            color: 'var(--text-dim)',
            marginTop: '1em',
          }}
        >
          (Shift-click modules in graph to expand/collapse)
        </div>
      </Section>

    </Pane>
  );
}