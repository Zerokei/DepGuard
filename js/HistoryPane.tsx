import { quantize } from 'd3-interpolate';
import { scaleOrdinal } from 'd3-scale';
import { interpolateSpectral } from 'd3-scale-chromatic';
import { select } from 'd3-selection';
import { arc, pie } from 'd3-shape';
import React, { useEffect, useRef, useState } from 'react';
import { store, useColorize, useExcludes, useIncludeDev } from "./App";
import { Toggle } from './Components';
import { hslFor, getDependencyEntries } from './Graph';
import { Pane, Section, Tag, Tags } from './Inspector';
import { GraphState, ModuleInfo, Person } from "./types";
import { fetchJSON, simplur } from "./util";
import { Chart, registerables} from "chart.js";
import { Line } from 'react-chartjs-2';
import '/css/HistoryPane.scss';

const defaultData = {
  labels: ['2022', '2023'],
  datasets: [
    {
      label: "None",
      backgroundColor: "rgb(255, 99, 132)",
      borderColor: "rgb(255, 99, 132)",
      data: [0, 0],
    }
  ],
}

async function modulesForQuery(query, includeDev, moduleFilter) {
  const graphState: GraphState = {
    modules: new Map(),
    referenceTypes: new Map(),
  };

  function _walk(module, level = 0) {
    if (!module) return Promise.resolve(Error('Undefined module'));

    // Array?  Apply to each element
    if (Array.isArray(module)) {
      return Promise.all(module.map(m => _walk(m, level)));
    }

    // Skip modules we've already seen
    if (graphState.modules.has(module.key)) return Promise.resolve();

    // Get dependency [name, version, dependency type] entries
    const depEntries = moduleFilter(module)
      ? getDependencyEntries(module, includeDev, level)
      : [];

    // Create object that captures info about how this module fits in the dependency graph
    const info: { module: ModuleInfo; level: number; dependencies?: object[] } =
      { module, level };
    graphState.modules.set(module.key, info);

    return Promise.all(
      depEntries.map(async ([name, version, type]) => {
        const module = await store.getModule(name, version);

        // Record the types of dependency references to this module
        if (!graphState.referenceTypes.has(module.key)) {
          graphState.referenceTypes.set(module.key, new Set());
        }
        graphState.referenceTypes.get(module.key).add(type);

        if (type !== 'peerDependencies') {
          await _walk(module, level + 1);
        }
        return { module, type };
      })
    ).then(dependencies => (info.dependencies = dependencies));
  }

  // Walk dependencies of each module in the query
  const m = await store.getModule(query);
  return m && _walk(m).then(() => graphState);
  // return Promise.all(
  //   query.map(async name => {
  //     const m = await store.getModule(name);
  //     return m && _walk(m);
  //   })
  // ).then(() => graphState);
}

function removeDuplicate(arr) {
  const map = new Map()
  const newArr = []

  arr.forEach(item => {
    if (!map.has(item.email)) { // has()用于判断map是否包为item的属性值
      map.set(item.email, true) // 使用set()将item设置到map中，并设置其属性值为true
      newArr.push(item)
    }
  })

  return newArr
}

export default function HistoryPane({ graph: graph, ...props }) {
  const pkg = graph?.modules.entries().next().value;
  const pkgName = pkg?pkg[1].module.package.name:'';
  const [historyData, setHistoryData] = useState(defaultData);
  const [developData, setDevelopData] = useState(defaultData);
  const [excludes, setExcludes] = useExcludes();
  function moduleFilter({ name }) {
    return !excludes?.includes(name);
  }
  useEffect(() => {
    setHistoryData(defaultData)
    fetchJSON(`https://registry.npmjs.org/${pkgName}`)
      .then(data => {
        const timeJson = data['time']
        const timeKey = Object.keys(timeJson);
        let historyList = {};
        let infoList = [];
        for (var i = 2; i < timeKey.length; i++) {
          const version = timeKey[i];
          const date = new Date(timeJson[version]);
          const year = date.getFullYear();
          const fullDate = year + '-' + (date.getMonth()+1) + '-' + date.getDate();
          modulesForQuery(
            `${pkgName}@${version}`, false, moduleFilter,
          ).then(modules => {
            let maintainers = [];
            let packages = [];
            for (const [name, pkgContent] of modules.modules.entries()) {
              for (const maintainer of pkgContent.module.package.maintainers) {
                maintainers.push(maintainer)
              }
              packages.push(`${pkgContent.module.name}@${pkgContent.module.version}`)
            }
            maintainers = removeDuplicate(maintainers)
            packages = Array.from(new Set(packages))
            console.log(packages, packages.length)
            infoList.push({time: fullDate, maintainerCount: maintainers.length, packageCount: packages.length});
            infoList.sort(function(a, b) {
              const timeA = new Date(a.time);
              const timeB = new Date(b.time);
              return (timeA < timeB) ? -1 : 1;
            })
            setDevelopData({
              labels: infoList.map(function(element) {
                return element.time;
              }),

              datasets: [
                {
                  label: "Implicit Trusted Maintainer",
                  backgroundColor: "rgb(100, 100, 200)",
                  borderColor: "rgb(100, 100, 200)",
                  data: infoList.map(function(element) {
                    return element.maintainerCount;
                  }),
                  pointRadius: 0,
                  cubicInterpolationMode: 'monotone',
                },
                {
                  label: "Implicit Trusted Package",
                  backgroundColor: "rgb(100, 100, 100)",
                  borderColor: "rgb(100, 100, 100)",
                  data: infoList.map(function(element) {
                    return element.packageCount;
                  }),
                  pointRadius: 0,
                  cubicInterpolationMode: 'monotone',
                }
              ],
              options: {
                scales: {
                  x: {
                    type: 'time',
                    time: {
                      unit: 'day',
                      tooltipFormat: 'YYYY',
                      displayFormats: {
                        day: 'YYYY-MM-DD'
                      }
                    }
                  }
                }
              }
            })
          })
          historyList[year] = historyList[year] ? historyList[year] + 1 : 1;
        }
        setHistoryData({
          labels: Object.keys(historyList),
          datasets: [
            {
              label: "Publish Count",
              backgroundColor: "rgb(255, 99, 0)",
              borderColor: "rgb(255, 99, 0)",
              data: Object.values(historyList),
            }
          ],

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
      <h2>
        { pkgName } Develop History
      </h2>

      <Section title='Publish Information'>
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
      <Section title='Develop Information'>
        <Line data={ developData }
        />
        <div
          style={{
            fontSize: '90%',
            color: 'var(--text-dim)',
            marginTop: '1em',
          }}
        ></div>
      </Section>


    </Pane>
  );
}