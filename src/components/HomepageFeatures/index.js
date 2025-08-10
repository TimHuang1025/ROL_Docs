import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '割草战斗系统',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        类吸血鬼幸存者的爽快割草玩法，操控神话英雄释放神力，
        体验千军万马的战斗快感。
      </>
    ),
  },
  {
    title: 'SLG策略系统',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        占领领地、建设城市、组建联盟。从奥林匹斯到人间，
        打造属于你的神话帝国。
      </>
    ),
  },
  {
    title: '神话英雄收集',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        希腊诸神、北欧神话、东方传说等多文明英雄。
        独特技能体系与装备系统，打造最强阵容。
      </>
    ),
  },
];

// 组件其余部分保持不变

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
