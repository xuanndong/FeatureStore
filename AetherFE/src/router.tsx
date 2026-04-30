import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { MaterializationPage } from './pages/Materialization/MaterializationPage';

// Each page is loaded only when the user navigates to it
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const FeatureGroupsPage = lazy(() => import('@/pages/FeatureGroups/FeatureGroupsPage').then(m => ({ default: m.FeatureGroupsPage })));
const CreateFeatureGroupWizard = lazy(() => import('@/pages/FeatureGroups/CreateFeatureGroupWizard').then(m => ({ default: m.CreateFeatureGroupWizard })));
const FeatureGroupDetail = lazy(() => import('@/pages/FeatureGroups/FeatureGroupDetail').then(m => ({ default: m.FeatureGroupDetail })));
const EntityRegistryPage = lazy(() => import('@/pages/EntityRegistry/EntityRegistryPage').then(m => ({ default: m.EntityRegistryPage })));
const DataSourcesPage = lazy(() => import('@/pages/DataSources/DataSourcesPage').then(m => ({ default: m.DataSourcesPage })));
const TransformationsPage = lazy(() => import('@/pages/Transformations/TransformationsPage').then(m => ({ default: m.TransformationsPage })));
const FeatureViewsPage = lazy(() => import('@/pages/FeatureViews/FeatureViewsPage').then(m => ({ default: m.FeatureViewsPage })));
// const OnlineExplorerPage = lazy(() => import('@/pages/OnlineExplorer/OnlineExplorerPage').then(m => ({ default: m.OnlineExplorerPage })));
const DatasetWorkspacePage = lazy(() => import('@/pages/Materialization/DatasetWorkspacePage').then(m => ({ default: m.DatasetWorkspacePage })));

const PageSpinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem' }}>
    <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
  </div>
);

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route
          index
          element={
            <Suspense fallback={<PageSpinner />}>
              <Dashboard />
            </Suspense>
          }
        />

        <Route
          path="feature-groups"
          element={
            <Suspense fallback={<PageSpinner />}>
              <FeatureGroupsPage />
            </Suspense>
          }
        />
        <Route
          path="feature-groups/new"
          element={
            <Suspense fallback={<PageSpinner />}>
              <CreateFeatureGroupWizard />
            </Suspense>
          }
        />
        <Route
          path="feature-groups/:id"
          element={
            <Suspense fallback={<PageSpinner />}>
              <FeatureGroupDetail />
            </Suspense>
          }
        />

        <Route
          path="entities"
          element={
            <Suspense fallback={<PageSpinner />}>
              <EntityRegistryPage />
            </Suspense>
          }
        />
        <Route
          path="data-sources"
          element={
            <Suspense fallback={<PageSpinner />}>
              <DataSourcesPage />
            </Suspense>
          }
        />
        <Route
          path="transformations"
          element={
            <Suspense fallback={<PageSpinner />}>
              <TransformationsPage />
            </Suspense>
          }
        />
        <Route
          path="feature-views"
          element={
            <Suspense fallback={<PageSpinner />}>
              <FeatureViewsPage />
            </Suspense>
          }
        />
        {/* <Route
          path="online-explorer"
          element={
            <Suspense fallback={<PageSpinner />}>
              <OnlineExplorerPage />
            </Suspense>
          }
        /> */}
        <Route
          path="materialization"
          element={
            <Suspense fallback={<PageSpinner />}>
              <MaterializationPage />
            </Suspense>
          }
        />
        <Route
          path="materialization/workspace/:datasetId"
          element={
            <Suspense fallback={<PageSpinner />}>
              <DatasetWorkspacePage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
};
