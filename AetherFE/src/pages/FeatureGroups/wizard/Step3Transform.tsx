import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { X, Package, AlertCircle, Info } from 'lucide-react';
import type { TransformationType, WizardTransformStep, SourceFormat } from '@/types';

// ============================================================================
// TEMPLATES
// ============================================================================
const TEMPLATES: Record<string, string> = {
  IMAGE: `# =====================================================================
# TRÍCH XUẤT ĐẶC TRƯNG ẢNH
# =====================================================================
# HƯỚNG DẪN DÙNG MODEL (VD: YOLO):
# 1. Thêm 'ultralytics' vào mục PYTHON ENVIRONMENTS bên phải.
# 2. Bỏ comment các đoạn code self.model bên dưới.

import cv2
import base64
# from ultralytics import YOLO

class UDFProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name
        # Khởi tạo mô hình 1 lần duy nhất để tối ưu hiệu năng
        # self.model = YOLO('yolov8n.pt') 

    def __call__(self, batch):
        """
        Định dạng đầu vào: 'batch' là một Python Dictionary.
        batch['image'] chứa danh sách (list) các mảng Numpy (numpy.ndarray) đại diện cho ảnh.
        """
        results_list = []
        
        # --- NẾU DÙNG MODEL ---
        # predictions = self.model(batch['image'], verbose=False)
        # for pred in predictions:
        #     person_count = sum(1 for box in pred.boxes if box.cls == 0)
        #     results_list.append({"person_count": person_count, "status": "SUCCESS"})
        
        # --- NẾU DÙNG OPENCV CƠ BẢN ---
        for img in batch['image']:
            if img is None:
                continue
            h_img, w_img = img.shape[:2]
            
            # Xử lý ảnh cơ bản
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            _, buffer = cv2.imencode('.jpg', gray)
            
            results_list.append({
                "width": w_img,
                "height": h_img,
                "thumbnail_gray": base64.b64encode(buffer).decode('utf-8'),
                "status": "SUCCESS"
            })
            
        return results_list`,

  VIDEO: `# =====================================================================
# TRÍCH XUẤT ĐẶC TRƯNG VIDEO
# =====================================================================
# HƯỚNG DẪN DÙNG MODEL ACTION RECOGNITION:
# Do video có dung lượng lớn, vui lòng dùng self.fs để tải file tạm trước khi xử lý.

import cv2
import tempfile
# import torch
# from torchvision.models.video import r3d_18

class VideoProcessor:
    def __init__(self, dataset_name, fs):
        self.ds_name = dataset_name
        self.fs = fs # FileSystem kết nối với hệ thống lưu trữ
        
        # Khởi tạo mô hình tại đây
        # self.model = r3d_18(pretrained=True)

    def __call__(self, batch):
        """
        Định dạng đầu vào: 'batch' là một Python Dictionary.
        batch['path'] chứa danh sách các chuỗi (string) là đường dẫn file video.
        """
        results = []
        for path in batch["path"]:
            try:
                # 1. Tải video qua mạng vào file tạm để xử lý
                with self.fs.open(path, 'rb') as f_in:
                    with tempfile.NamedTemporaryFile(delete=True, suffix=".mp4") as tmp_file:
                        tmp_file.write(f_in.read())
                        tmp_file.flush()
                        
                        # 2. Xử lý video bằng OpenCV
                        cap = cv2.VideoCapture(tmp_file.name)
                        
                        # --- CHÈN LOGIC MODEL CỦA BẠN VÀO ĐÂY ---
                        # frames = get_frames(cap)
                        # action_class = self.model(frames)
                        
                        results.append({
                            "video_path": path,
                            "fps": round(cap.get(cv2.CAP_PROP_FPS), 2),
                            "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                            "status": "SUCCESS"
                        })
                        cap.release()
            except Exception as e:
                results.append({"video_path": path, "error": str(e), "status": "FAILED"})
        return results`,

  AUDIO: `# =====================================================================
# TRÍCH XUẤT ĐẶC TRƯNG AUDIO
# =====================================================================
# HƯỚNG DẪN DÙNG MODEL SPEECH-TO-TEXT (VD: Whisper):
# Thêm 'openai-whisper' vào PYTHON ENVIRONMENTS.

import wave
import io
# import whisper

class AudioProcessor:
    def __init__(self, dataset_name, fs):
        self.ds_name = dataset_name
        self.fs = fs
        
        # Khởi tạo mô hình
        # self.model = whisper.load_model("base")

    def __call__(self, batch):
        """
        Định dạng đầu vào: 'batch' là một Python Dictionary.
        batch['path'] chứa danh sách các chuỗi (string) là đường dẫn file audio.
        """
        results = []
        for path in batch["path"]:
            try:
                with self.fs.open(path, 'rb') as f:
                    audio_bytes = f.read()
                    
                    # --- NẾU DÙNG MODEL ---
                    # result = self.model.transcribe(io.BytesIO(audio_bytes))
                    # transcript = result["text"]
                    
                    # --- NẾU ĐỌC METADATA CƠ BẢN ---
                    with wave.open(io.BytesIO(audio_bytes), 'rb') as wav_file:
                        results.append({
                            "audio_path": path,
                            "channels": wav_file.getnchannels(),
                            "sample_rate_hz": wav_file.getframerate(),
                            # "transcript": transcript,
                            "status": "SUCCESS"
                        })
            except Exception as e:
                results.append({"audio_path": path, "error": str(e), "status": "FAILED"})
        return results`,

  TEXT: `# =====================================================================
# TRÍCH XUẤT ĐẶC TRƯNG VĂN BẢN
# =====================================================================
# HƯỚNG DẪN DÙNG MODEL (VD: HuggingFace SentenceTransformers):
# Thêm 'sentence-transformers' vào PYTHON ENVIRONMENTS.

# from sentence_transformers import SentenceTransformer

class TextProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name
        # Khởi tạo mô hình
        # self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def __call__(self, batch):
        """
        Định dạng đầu vào: 'batch' là một Python Dictionary.
        batch['text'] chứa danh sách các chuỗi văn bản (list of strings).
        """
        results = []
        
        # --- NẾU DÙNG MODEL (Xử lý mảng trực tiếp) ---
        # embeddings = self.model.encode(batch['text'])
        
        for idx, text in enumerate(batch["text"]):
            clean_text = str(text).strip()
            results.append({
                "char_count": len(clean_text),
                "word_count": len(clean_text.split()),
                "preview": clean_text[:50] + "...",
                # "embedding": embeddings[idx].tolist(),
                "status": "SUCCESS"
            })
        return results`,

  STRUCTURED: `# =====================================================================
# BIẾN ĐỔI DỮ LIỆU BẢNG (Tabular Data)
# =====================================================================
import pandas as pd
# import xgboost as xgb

class TabularProcessor:
    def __init__(self, dataset_name):
        self.ds_name = dataset_name
        # Tải Pre-trained ML Model nếu cần trích xuất đặc trưng phức tạp
        # self.model = xgb.XGBClassifier()
        # self.model.load_model('model.json')

    def __call__(self, batch):
        """
        Định dạng đầu vào: 'batch' là một Python Dictionary chứa các mảng dữ liệu theo cột.
        Cách dễ nhất để xử lý là ép kiểu trực tiếp thành Pandas DataFrame.
        """
        df = pd.DataFrame(batch)

        # Logic mẫu: Lọc dữ liệu và tạo feature mới
        if "amount" in df.columns:
            df = df[df["amount"] > 0].copy()
            df["discounted_amount"] = df["amount"] * 0.9
            df["spend_category"] = df["amount"].apply(lambda x: "High" if x > 1000 else "Low")
            
            # df["ml_score"] = self.model.predict_proba(df[['feature1', 'feature2']])[:, 1]

        return df`,

  SQL: `-- =====================================================================
-- BIẾN ĐỔI DỮ LIỆU BẢNG VỚI SQL
-- =====================================================================
-- BẮT BUỘC: Phải SELECT cột sử dụng làm join key (vd: user_id) để ghép nối dữ liệu

SELECT
    -- Example
    user_id,             -- Thay 'user_id' bằng cột Join Key thực tế của bạn
    COUNT(*) as total_records,
    MAX(amount) as max_amount,
    MIN(amount) as min_amount
FROM source_data;`,

  AGGREGATION: `-- Tính năng Aggregation đang được phát triển
-- Vui lòng sử dụng SQL hoặc Python UDF`
};

const STANDARD_LIBS = ['pandas', 'numpy', 'scikit-learn', 'pyarrow', 's3fs'];

interface Step3TransformProps {
  transformStep: WizardTransformStep & {
    requirements?: string[];
  };
  sourceFormat?: SourceFormat; 
  isPreviewing: boolean;
  onStepChange: (step: any) => void;
  onRunScript: () => void;
}

export const Step3Transform: React.FC<Step3TransformProps> = React.memo(({
  transformStep, 
  sourceFormat = 'PARQUET', 
  isPreviewing, 
  onStepChange, 
  onRunScript
}) => {
  const [reqInput, setReqInput] = useState('');

  const getTemplate = (type: TransformationType, format: SourceFormat) => {
    if (type === 'SQL') return TEMPLATES.SQL;
    if (type === 'AGGREGATION') return TEMPLATES.AGGREGATION;
    
    // PYTHON_UDF based on SourceFormat
    if (format === 'IMAGE') return TEMPLATES.IMAGE;
    if (format === 'VIDEO') return TEMPLATES.VIDEO;
    if (format === 'AUDIO') return TEMPLATES.AUDIO;
    if (format === 'TEXT') return TEMPLATES.TEXT;
    return TEMPLATES.STRUCTURED;
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as TransformationType;
    onStepChange({ 
      ...transformStep, 
      transform_type: newType, 
      transform_definition: getTemplate(newType, sourceFormat), 
      previewOk: false 
    });
  };

  const handleResetTemplate = () => {
    onStepChange({ 
      ...transformStep, 
      transform_definition: getTemplate(transformStep.transform_type, sourceFormat), 
      previewOk: false 
    });
  };

  const handleAddRequirement = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && reqInput.trim()) {
      e.preventDefault();
      const newReq = reqInput.trim().toLowerCase();
      
      const currentReqs = transformStep.requirements || [];
      if (!currentReqs.includes(newReq) && !STANDARD_LIBS.includes(newReq.split('==')[0])) {
        onStepChange({
          ...transformStep,
          requirements: [...currentReqs, newReq]
        });
      }
      setReqInput('');
    }
  };

  const handleRemoveRequirement = (reqToRemove: string) => {
    const currentReqs = transformStep.requirements || [];
    onStepChange({
      ...transformStep,
      requirements: currentReqs.filter(r => r !== reqToRemove)
    });
  };

  return (
    <div className="wizard-step3-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
      
      {/* EDITOR */}
      <div style={{ height: '650px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1e1e1e', padding: '8px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <span style={{ color: '#a3a3a3', fontSize: '12px', fontFamily: 'monospace' }}>
              {transformStep.transform_type === 'SQL' ? 'transformation.sql' : 'udf_processor.py'}
           </span>
           <span style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>
              FORMAT: {sourceFormat}
           </span>
        </div>
        <Editor
          height="100%"
          language={transformStep.transform_type === 'SQL' ? 'sql' : 'python'}
          theme="vs-dark"
          value={transformStep.transform_definition}
          onChange={(val) => onStepChange({ ...transformStep, transform_definition: val || '', previewOk: false })}
          options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
        />
      </div>

      {/* CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px', maxHeight: '650px' }}>
        
        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', background: '#7c3aed', color: 'white', border: 'none', padding: '10px', fontWeight: 600 }}
            onClick={onRunScript}
            disabled={isPreviewing}
          >
            {isPreviewing ? <div className="spinner spinner-sm" /> : '▶ Chạy thử nghiệm (Preview)'}
          </button>
          
          <button
            className="btn btn-reset"
            onClick={handleResetTemplate}
            style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-secondary)', padding: '8px', fontSize: '13px' }}
          >
            ↺ Khôi phục code mẫu
          </button>

          {transformStep.previewOk && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textAlign: 'center', marginTop: '8px' }}>
              ✓ Preview thành công. Script hợp lệ!
            </div>
          )}
        </div>

        {/* Config */}
        <div>
          <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>TRANSFORMATION TYPE</label>
          <select className="form-select" value={transformStep.transform_type} onChange={handleTypeChange}>
            <option value="SQL">SQL (Chỉ dùng cho dữ liệu bảng)</option>
            <option value="PYTHON_UDF">Python UDF (Hỗ trợ AI Models, CV, NLP)</option>
            <option value="AGGREGATION">Aggregation (WIP)</option>
          </select>
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>TRANSFORMATION NAME</label>
          <input
            type="text" className="form-input" placeholder="Ví dụ: object_detection_features"
            value={transformStep.transformation_name}
            onChange={(e) => onStepChange({ ...transformStep, transformation_name: e.target.value })}
          />
        </div>

        {/* PYTHON ENVIRONMENTS */}
        {transformStep.transform_type === 'PYTHON_UDF' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
            
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <Package size={14} /> MÔI TRƯỜNG THỰC THI (PIP PACKAGES)
              </label>
              
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  THƯ VIỆN CÓ SẴN TRÊN HỆ THỐNG:
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-main)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {STANDARD_LIBS.map(lib => <span key={lib} style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{lib}</span>)}
                </div>
              </div>

              <div>
                <input
                  type="text" className="form-input" 
                  placeholder="Thêm thư viện (vd: ultralytics, torch) -> Enter"
                  value={reqInput} onChange={(e) => setReqInput(e.target.value)} onKeyDown={handleAddRequirement}
                  style={{ fontSize: '13px' }}
                />
              </div>
              
              {(transformStep.requirements && transformStep.requirements.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {transformStep.requirements.map(req => (
                    <div key={req} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                      {req}
                      <X size={14} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => handleRemoveRequirement(req)} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', background: 'rgba(56, 189, 248, 0.1)', padding: '10px', borderRadius: '8px', marginTop: '12px' }}>
                 <Info size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                 <div style={{ fontSize: '11px', color: '#0369a1', lineHeight: 1.4 }}>
                   Hệ thống sẽ tự động cấu hình môi trường ảo chứa các thư viện này. Quá trình có thể mất 30s-1p trong lần khởi chạy đầu tiên.
                 </div>
              </div>
              
              {/* Note Warning */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', marginTop: '8px' }}>
                 <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                 <div style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.5 }}>
                   <strong>Lưu ý:</strong> Việc thêm các thư viện quá nặng hoặc cấu hình sai phiên bản có thể khiến quá trình Preview bị lỗi.
                 </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
});

Step3Transform.displayName = 'Step3Transform';
