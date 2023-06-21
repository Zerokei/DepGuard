import { hierarchy, treemap } from 'd3-hierarchy';
import React, { useEffect, useState } from 'react';
import { ExternalLink, Pane, QueryLink, Section, Tag, Tags } from './Inspector';
import { npmsioResponse } from './types';
import { $, fetchJSON, human, simplur } from './util';
import * as semver from 'semver';
import '/css/ModulePane.scss';

function ScoreBar({ title, score, style }) {
  const perc = (score * 100).toFixed(0) + '%';
  const inner = (
    <div
      style={{
        width: perc,
        textAlign: 'right',
        backgroundColor: `hsl(${score * 120}, 75%, 70%)`,
        ...style,
      }}
    >
      {perc}
    </div>
  );

  return (
    <>
      <span style={{ marginRight: '1em', ...style }}>{title}</span>
      <div
        className="score-bar"
        style={{ border: 'solid 1px #ccc', width: '200px' }}
      >
        {inner}
      </div>
    </>
  );
}


// ref: https://github.com/abbasjavan/DependencySniffer/blob/master/DepSniffer.py
function getDependencyType(version: string): string | null {

  if (!version) {
    return null;
  }
  else if (version.includes('~')) {
    return 'restrictive'; // 限制版本号类型
  } else if (version.includes('*')
          || version.includes('>')
          || version.includes('latest')){
    return 'permissive'; // 宽松版本号类型
  }
  else if (semver.valid(version)) {
    return 'exact'; // 精确版本号类型
  } else if (version.includes('http')
          || version.includes('git')) {
    return 'url'; // url 类型
  } else {
    return 'normal';
  }
}

function TreeMap({ data, style, ...props }) {
  const [leaves, setLeaves] = useState([]);

  // Render contents as an "effect" because d3 requires the pixel dimensions of the div
  useEffect(() => {
    const { clientWidth: w, clientHeight: h } = $('#treemap')[0],
      m = 1;

    const { size } = data;

    // eslint-disable-next-line no-undef
    const root = hierarchy(data, ({ dependencySizes: nodes }) => {
      if (!nodes) return;

      const sum = nodes?.reduce((sum, n) => sum + n.approximateSize, 0);

      // Normalize sizes to match total package size
      // See https://github.com/pastelsky/bundlephobia/issues/417
      nodes.forEach(node => (node.approximateSize *= size / sum));

      // Combine dependencies that are < 1% of bundle size
      const MIN_SIZE = sum * 0.01;
      const misc = nodes.filter(n => n.approximateSize < MIN_SIZE);
      nodes = nodes.filter(n => n.approximateSize >= MIN_SIZE);
      if (misc.length == 1) {
        nodes.push(misc[0]);
      } else if (misc.length > 1) {
        nodes.push({
          name: `${misc.length} small modules`,
          approximateSize: misc.reduce((sum, n) => sum + n.approximateSize, 0),
        });
      }

      nodes.sort((a, b) => b.approximateSize - a.approximateSize);

      return nodes;
    })
      .sum(v => v.approximateSize)
      .sort((a, b) => b.value - a.value);

    // eslint-disable-next-line no-undef
    treemap().size([w, h]).padding(0)(root);

    setLeaves(
      root.leaves().map((d, i, a) => {
        const size = human(d.value, 'B');
        const frac = ((d.x1 - d.x0) * (d.y1 - d.y0)) / (w * h);
        return (
          <div
            key={i}
            title={`${d.data.name} (${size})`}
            className="bundle-item"
            style={{
              left: `${d.x0 + m / 2}px`,
              top: `${d.y0 + m / 2}px`,
              width: `${d.x1 - d.x0 - m}px`,
              height: `${d.y1 - d.y0 - m}px`,
              fontSize: `${65 + 70 * Math.sqrt(frac)}%`,
              backgroundColor: `hsl(${
                (75 + (i / a.length) * 360) % 360
              }, 50%, 70%)`,
            }}
          >
            {d.data.name} <span>{size}</span>
          </div>
        );
      })
    );
  }, [data]);

  return (
    <div id="treemap" style={{ position: 'relative', ...style }} {...props}>
      {leaves}
    </div>
  );
}


async function searchPackageJsonField(link) {
  return await new Promise((resolve) =>
    fetch(link).then(res => {
      if (res.ok) {
        resolve(true);
      } else {
        resolve(false);
      }
    })
  )
}


export default function ModulePane({ module, ...props }) {
  console.log(module);
  const pkg = module?.package;

  const [bundleInfo, setBundleInfo] = useState(null);
  const [npmsInfo, setNpmsInfo] = useState(null);
  const [packageInfo, setPackageInfo] = useState(null);
  const [smells, setSmells] = useState({});

  const pn = pkg ? encodeURIComponent(`${pkg.name}@${pkg.version}`) : null;

  useEffect(() => {
    setBundleInfo(pkg ? null : Error('No package selected'));
    setNpmsInfo(null);
    setPackageInfo(null);
    setSmells({
      'pinned-dependency': 0,
      'url-dependency': 0,
      'restrictive-constraint': 0,
      'permissive-constraint': 0,
      'no-package-lock': 0,
      'unused-dependency': 'N/A',
      'missing-dependency': 'N/A',
      'score': 1,
    });

    if (!pkg) return;

    fetchJSON(`https://bundlephobia.com/api/size?package=${pn}`)
      .then(setBundleInfo)
      .catch(setBundleInfo);

    fetchJSON<npmsioResponse>(`https://api.npms.io/v2/package/${pkg.name}`)
      .then(search => setNpmsInfo(search.score))
      .catch(setNpmsInfo);

    fetchJSON<npmsioResponse>(module.apiLink)
      .then(data => {
        console.log(data)
        setPackageInfo(data);

        const tempSmell = {
          'pinned-dependency': 0,
          'url-dependency': 0,
          'restrictive-constraint': 0,
          'permissive-constraint': 0,
          'no-package-lock': 0,
          'unused-dependency': 'N/A',
          'missing-dependency': 'N/A',
          'score': 1,
        };
        // 遍历 pkg.dependencies
        const dependencies = data['dependencies'];
        for (const depPkg in dependencies) {
          const dependencyType = getDependencyType(dependencies[depPkg]);
          switch (dependencyType) {
            case 'permissive':
              tempSmell['permissive-constraint'] += 1;
            break;
            case 'restrictive':
              tempSmell['restrictive-constraint'] += 1;
            break;
            case 'exact':
              tempSmell['pinned-dependency'] += 1;
              break;
            case 'url':
              tempSmell['url-dependency'] += 1;
              break;
            default:
              break;
          }
        }
        const dependencyCount = Object.keys(dependencies || []).length;

        // const fileTreeLink = module.npmLink + '/index';
        const fileTreeLink = 'https://unpkg.com/:package@:version/:file';
        searchPackageJsonField(fileTreeLink).then(hasPackageJson => {
          console.log(tempSmell['pinned-dependency'], dependencyCount)
          if (tempSmell['pinned-dependency'] === dependencyCount) { // 所有包的版本都已经锁定，所以不需要 package-lock.json
            tempSmell['no-package-lock'] = 0;
          } else if (dependencyCount === 0) { // 没有依赖包，所以不需要 package-lock.json
            tempSmell['no-package-lock'] = 0;
          } else {
            tempSmell['no-package-lock'] = hasPackageJson ? 0 : 1;
          }

          if (dependencyCount === 0) {
            tempSmell['score'] = 0.1 * (tempSmell['no-package-lock'] === 1 ? 0 : 1) + 0.9
          } else {
            tempSmell['score'] =
              (dependencyCount - tempSmell['pinned-dependency'] * 0.8 - tempSmell['url-dependency']
                - tempSmell['restrictive-constraint'] * 0.6 - tempSmell['permissive-constraint'] * 0.6)
              / dependencyCount * 0.9 + 0.1 * (tempSmell['no-package-lock'] === 1 ? 0 : 1)
          }
          setSmells(tempSmell);
        });

      })
      .catch(setPackageInfo);


  }, [pkg]);
  // console.log(smells);


  if (!pkg) {
    return (
      <Pane>
        No module selected. Click a module in the graph to see details.
      </Pane>
    );
  }

  if (pkg.stub) {
    return (
      <Pane>
        <h2>{module.name}</h2>
        <p>
          Information and dependencies for this module cannot be displayed due
          to the following error:
        </p>
        <p style={{ color: 'red', fontWeight: 'bold' }}>{pkg.error?.message}</p>
      </Pane>
    );
  }

  const bpUrl = `https://bundlephobia.com/result?p=${pn}`;

  const scores = npmsInfo?.detail || {};
  if (npmsInfo) scores.final = npmsInfo.final;

  function BundleStats({ bundleInfo }) {

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '.3em 1em',
        }}
      >
        <span>Minified:</span>
        <strong>{human(bundleInfo.size, 'B')}</strong>
        <span>Gzipped:</span>
        <strong>{human(bundleInfo.gzip, 'B')}</strong>
      </div>
    );
  }

  return (
    <Pane {...props}>
      <h2>
        <QueryLink query={module.key} />
      </h2>

      {pkg.deprecated ? (
        <div
          className="warning"
          style={{ padding: '.5em', borderRadius: '.5em' }}
        >
          <h2 style={{ color: 'darkred', marginTop: 0 }}>Deprecated Module</h2>
          {pkg.deprecated}
        </div>
      ) : null}

      <p>{pkg?.description}</p>

      <ExternalLink href={module.npmLink} style={{ marginRight: '1em' }}>
        npm
      </ExternalLink>
      {module.repoLink ? (
        <ExternalLink href={module.repoLink} style={{ marginRight: '1em' }}>
          GitHub
        </ExternalLink>
      ) : null}
      {
        // Displaying dropped package contents is a bit problematic, but we give it a shot here.
        module.package?._dropped ? (
          <ExternalLink
            href={`data:text/json;base64,${btoa(
              JSON.stringify(module.package)
            )}`}
          >
            package.json
          </ExternalLink>
        ) : (
          <ExternalLink href={module.apiLink}>package.json</ExternalLink>
        )
      }

      <Section title="Bundle Size">
        {bundleInfo ? <BundleStats bundleInfo={bundleInfo} /> : null}
        {!bundleInfo ? (
          <span>Loading ...</span>
        ) : bundleInfo instanceof Error ? (
          <span>Unavailable</span>
        ) : (
          <TreeMap
            style={{ height: '150px', margin: '1em' }}
            data={bundleInfo}
          />
        )}
        {bundleInfo && !(bundleInfo instanceof Error) ? (
          <>
            Data source: <ExternalLink href={bpUrl}>BundlePhobia</ExternalLink>
          </>
        ) : null}
      </Section>

      <Section title="npms.io Score">
        {!npmsInfo ? (
          'Loading'
        ) : npmsInfo instanceof Error ? (
          'Unavailable'
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              marginTop: '1em',
              rowGap: '1px',
            }}
          >
            <ScoreBar
              style={{ fontWeight: 'bold' }}
              title="Overall"
              score={scores.final}
            />
            <ScoreBar
              style={{ fontSize: '.85em' }}
              title="Quality"
              score={scores.quality}
            />
            <ScoreBar
              style={{ fontSize: '.85em' }}
              title="Popularity"
              score={scores.popularity}
            />
            <ScoreBar
              style={{ fontSize: '.85em' }}
              title="Maintenance"
              score={scores.maintenance}
            />
          </div>
        )}
      </Section>
      <Section title={"Dependency Smells"}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '.3em 1em',
          }}
        >
          <ScoreBar
            style={{ fontWeight: 'bold' }}
            title="Dependency Quality"
            score={ smells['score'] }
          />
          <span>Pinned dependency:</span>
          <strong>{smells['pinned-dependency']}</strong>
          <span>URL dependency:</span>
          <strong>{smells['url-dependency']}</strong>
          <span>Restrictive constraint:</span>
          <strong>{smells['restrictive-constraint']}</strong>
          <span>Permissive constraint:</span>
          <strong>{smells['permissive-constraint']}</strong>
          <span>No package lock:</span>
          <strong>{smells['no-package-lock']}</strong>
        </div>

      </Section>
      <Section
        title={simplur`${
          Object.entries(pkg?.maintainers).length
        } Maintainer[|s]`}
      >
        <Tags>
          {pkg.maintainers.map(({ name, email }) => (
            <Tag
              key={name + email}
              name={name}
              type="maintainer"
              gravatar={email}
            />
          ))}
        </Tags>
      </Section>
    </Pane>
  );
}
