'use client';

import Layout from '../../components/Layout';
import PageAccessControl from '../../components/PageAccessControl';

export default function AuditLogPage() {
  return (
    <Layout>
      <PageAccessControl pageName="audit-log">
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">🚧 Under Maintenance</h2>
            <p className="text-yellow-700">Audit Log feature is temporarily disabled for system optimization.</p>
            <p className="text-yellow-600 text-sm mt-2">Please check back later.</p>
          </div>
        </div>
      </PageAccessControl>
    </Layout>
  );
}