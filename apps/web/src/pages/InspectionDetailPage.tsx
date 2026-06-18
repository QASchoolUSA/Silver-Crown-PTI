import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CheckCircle, XCircle, Download } from 'lucide-react';
import { getInspectionById, formatInspectionDate, generateInspectionPdfHtml } from '@silver-crown/shared';
import type { Inspection } from '@silver-crown/shared';

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getInspectionById(id).then(setInspection).finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = () => {
    if (!inspection) return;
    const html = generateInspectionPdfHtml(inspection);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!inspection) return <p className="text-on-surface-variant">Inspection not found.</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider">INSPECTION DETAIL</h1>
          <p className="text-on-surface-variant mt-2">{formatInspectionDate(inspection.createdAt)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
          inspection.status === 'PASS' ? 'bg-primary/20 text-primary' : 'bg-error-container/30 text-error'
        }`}>{inspection.status}</span>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-on-surface-variant">Driver:</span> <span className="font-semibold">{inspection.driverName}</span></div>
        <div><span className="text-on-surface-variant">Truck:</span> <span className="font-semibold">{inspection.truckNumber}</span></div>
        {inspection.trailerNumber && <div><span className="text-on-surface-variant">Trailer:</span> <span className="font-semibold">{inspection.trailerNumber}</span></div>}
      </div>

      <button onClick={handleDownloadPdf} className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider mb-8 hover:bg-primary/10">
        <Download size={16} /> Download PDF
      </button>

      {inspection.sections.map((section) => (
        <div key={section.id} className="mb-6">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{section.title}</h3>
          <div className="bg-surface-container border border-outline-variant rounded-lg divide-y divide-outline-variant">
            {section.items.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  {item.notes && <p className="text-error text-sm mt-1">Note: {item.notes}</p>}
                  {item.photoUrl && <img src={item.photoUrl} alt={item.name} className="w-20 h-16 object-cover rounded mt-2" />}
                </div>
                {item.status === 'pass' ? <CheckCircle className="text-primary" size={24} /> :
                 item.status === 'fail' ? <XCircle className="text-error" size={24} /> : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {inspection.signatureUrl && (
        <div>
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Driver Signature</h3>
          <img src={inspection.signatureUrl} alt="Signature" className="max-w-xs border border-outline-variant rounded-lg bg-white" />
        </div>
      )}
    </div>
  );
}
