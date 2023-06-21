import { quantize } from 'd3-interpolate';
import { scaleOrdinal } from 'd3-scale';
import { interpolateSpectral } from 'd3-scale-chromatic';
import { select } from 'd3-selection';
import { arc, pie } from 'd3-shape';
import React, { useEffect, useRef, useState } from 'react';
import { useColorize, useExcludes, useIncludeDev } from './App';
import { Toggle } from './Components';
import { hslFor } from './Graph';
import { Pane, Section, Tag, Tags } from './Inspector';
import { Person } from './types';
import { fetchJSON, simplur } from "./util";
import { Chart, registerables} from "chart.js";
import { Line } from 'react-chartjs-2';
import '/css/HistoryPane.scss';

const defaultData = {
  labels: ['2022', '2023'],
  datasets: [
    {
      label: "Publish Count",
      backgroundColor: "rgb(255, 99, 132)",
      borderColor: "rgb(255, 99, 132)",
      data: [0, 0],
    }
  ]
}
export default function HistoryPane({ graph: graph, ...props }) {
  const pkg = graph?.modules.entries().next().value;
  const pkgName = pkg[1].module.package.name;
  const [historyData, setHistoryData] = useState(defaultData);

  useEffect(() => {
    setHistoryData(defaultData)
    fetchJSON(`https://registry.npmjs.org/${pkgName}`)
      .then(data => {
        const timeJson = data['time']
        const timeKey = Object.keys(timeJson);
        let historyList = {};
        for (var i = 2; i < timeKey.length; i++) {
          const verison = timeKey[i];
          const date = new Date(timeJson[verison]);
          const year = date.getFullYear();
          historyList[year] = historyList[year] ? historyList[year] + 1 : 1;
        }
        setHistoryData({
          labels: Object.keys(historyList),
          datasets: [
            {
              label: "Publish Count",
              backgroundColor: "rgb(255, 99, 132)",
              borderColor: "rgb(255, 99, 132)",
              data: Object.values(historyList),
            }
          ]
        });
      })
  }, [pkgName]);

  Chart.register(...registerables);
  // const labels = ["January", "February", "March", "April", "May", "June", "July",
  //                 "August", "September", "October", "Novenber", "December"];
  // const data = {
  //   labels: labels,
  //   datasets: [
  //     {
  //       label: "My First dataset",
  //       backgroundColor: "rgb(255, 99, 132)",
  //       borderColor: "rgb(255, 99, 132)",
  //       data: [0, 10, 5, 2, 20, 30, 45],
  //     },
  //   ],
  // };

  return (
    <Pane {...props}>


      <Section title='Module History'>
        <Line
          data={ historyData }
        />
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