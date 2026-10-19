/**
 * @file SubtitleManageModal.jsx
 * @module Admin/Modules/Episodes/Components/SubtitleManageModal
 * @description Modal quản lý danh sách phụ đề (WebVTT/SRT), tải lên bản dịch mới và xóa phụ đề cho tập phim.
 */

import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Subtitles, Upload, Trash2, Globe, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal, { ConfirmModal } from '@/shared/components/ui/modal';
import Button from '@/shared/components/ui/button/Button';
import Select from '@/shared/components/ui/select/Select';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import { useEpisodeSubtitlesQuery } from '@/hooks/queries/use-episode.queries';
import { useUploadSubtitleMutation, useDeleteSubtitleMutation } from '@/hooks/mutations/use-episode.mutations';
import './subtitle-manage-modal.scss';

const POPULAR_LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Tiếng Nhật (日本語)' },
  { code: 'zh', label: 'Tiếng Trung (中文)' },
  { code: 'ko', label: 'Tiếng Hàn (한국어)' },
  { code: 'es', label: 'Español' },
];

export const SubtitleManageModal = ({
  open = false,
  onClose,
  episode = null,
}) => {
  const episodeId = episode?.id;
  const movieId = episode?.movie_id;

  const fileInputRef = useRef(null);
  const [language, setLanguage] = useState('vi');
  const [label, setLabel] = useState('Tiếng Việt');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDefault, setIsDefault] = useState(false);

  const languageOptions = POPULAR_LANGUAGES.map((l) => ({
    value: l.code,
    label: `${l.label} (${l.code})`,
  }));

  const {
    data: subtitlesData,
    isLoading,
    refetch: refetchSubtitles,
  } = useEpisodeSubtitlesQuery(episodeId, {
    enabled: open && Boolean(episodeId),
  });
  const subtitles = Array.isArray(subtitlesData)
    ? subtitlesData
    : Array.isArray(subtitlesData?.data)
      ? subtitlesData.data
      : [];

  const uploadMutation = useUploadSubtitleMutation({
    onSuccess: () => {
      toast.success('Đã tải lên phụ đề thành công');
      setSelectedFile(null);
      setIsDefault(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      refetchSubtitles();
    },
    onError: (err) => {
      toast.error(err.message || 'Lỗi khi tải phụ đề lên');
    },
  });

  const deleteMutation = useDeleteSubtitleMutation({
    onSuccess: () => {
      toast.success('Đã xóa phụ đề');
      refetchSubtitles();
    },
    onError: (err) => {
      toast.error(err.message || 'Lỗi khi xóa phụ đề');
    },
  });

  const handleLanguageChange = (code) => {
    setLanguage(code);
    const found = POPULAR_LANGUAGES.find((l) => l.code === code);
    if (found) setLabel(found.label);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !episodeId) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('language', language);
    formData.append('label', label);
    formData.append('is_default', isDefault ? 'true' : 'false');
    formData.append('episode_id', episodeId);
    formData.append('movie_id', movieId);

    uploadMutation.mutate({ id: episodeId, formData });
  };

  const [deletingSub, setDeletingSub] = useState(null);

  const handleDelete = (sub) => {
    setDeletingSub(sub);
  };

  const handleConfirmDelete = () => {
    if (!deletingSub || !episodeId) return;
    const lang = deletingSub.language || deletingSub.srclang || deletingSub.id;
    deleteMutation.mutate(
      { id: episodeId, language: lang },
      {
        onSettled: () => {
          setDeletingSub(null);
        },
      }
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="medium"
      >
      <Modal.Header
        title={`Quản Lý Phụ Đề — ${episode?.title || `Tập ${episode?.episode_number || ''}`}`}
        subtitle="Danh sách phụ đề WebVTT/SRT và thêm bản dịch đa ngôn ngữ"
        onClose={onClose}
        showCloseButton
      />

      <Modal.Body>
        <div className="subtitle-modal">
          {/* Danh sách phụ đề hiện tại */}
          <div className="subtitle-modal__section">
            <div className="subtitle-modal__section-header">
              <Subtitles size={16} className="subtitle-modal__section-icon" />
              <h4 className="subtitle-modal__section-title">Danh Sách Phụ Đề Hiện Có</h4>
            </div>

            {isLoading ? (
              <div className="subtitle-modal__empty">Đang tải danh sách phụ đề...</div>
            ) : subtitles.length === 0 ? (
              <div className="subtitle-modal__empty">Tập phim này chưa có phụ đề nào</div>
            ) : (
              <div className="subtitle-modal__list">
                {subtitles.map((sub) => (
                  <div key={sub.id || sub.language} className="subtitle-modal__item">
                    <div className="subtitle-modal__item-info">
                      <Globe size={15} />
                      <span className="subtitle-modal__item-label">{sub.label || sub.language || sub.srclang || sub.id}</span>
                      <span className="subtitle-modal__item-code">{(sub.language || sub.srclang || sub.id || '').toUpperCase()}</span>
                      {sub.isDefault && (
                        <span className="subtitle-modal__badge">Mặc định</span>
                      )}
                    </div>
                    <div className="subtitle-modal__item-actions">
                      <Tooltip content="Mở file WebVTT trong tab mới" placement="top">
                        <IconButton
                          component="a"
                          href={sub.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          variant="standard"
                          aria-label="Xem file VTT"
                        >
                          <FileText size={15} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip content="Xóa phụ đề này vĩnh viễn" placement="top">
                        <IconButton
                          size="small"
                          variant="standard"
                          color="error"
                          onClick={() => handleDelete(sub)}
                          disabled={deleteMutation.isPending}
                          aria-label="Xóa phụ đề"
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tải lên phụ đề mới */}
          <div className="subtitle-modal__section">
            <div className="subtitle-modal__section-header">
              <Upload size={16} className="subtitle-modal__section-icon" />
              <h4 className="subtitle-modal__section-title">Tải Lên Phụ Đề Mới</h4>
            </div>

            <form onSubmit={handleUpload} className="subtitle-modal__form">
              <div className="subtitle-modal__form-row">
                <div className="subtitle-modal__field">
                  <label className="subtitle-modal__label">Ngôn Ngữ</label>
                  <Select
                    value={language}
                    onChange={(e, val) => handleLanguageChange(val !== undefined ? val : e?.target?.value)}
                    options={languageOptions}
                    size="medium"
                  />
                </div>

                <div className="subtitle-modal__field subtitle-modal__field--grow">
                  <label className="subtitle-modal__label">Nhãn Hiển Thị</label>
                  <input
                    type="text"
                    className="subtitle-modal__input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ví dụ: Tiếng Việt"
                    required
                  />
                </div>
              </div>

              <div className="subtitle-modal__file-picker">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="subtitle-file-input"
                  accept=".vtt,.srt"
                  className="subtitle-modal__hidden-input"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="subtitle-file-input" className="subtitle-modal__file-label">
                  {selectedFile ? (
                    <div className="subtitle-modal__picked-file">
                      <CheckCircle2 size={16} className="subtitle-modal__picked-icon" />
                      <span>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <span>Chọn tệp phụ đề (.vtt, .srt)</span>
                  )}
                </label>
              </div>

              <label className="subtitle-modal__checkbox-row">
                <input
                  type="checkbox"
                  className="subtitle-modal__checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <span className="subtitle-modal__checkbox-label">Đặt làm phụ đề mặc định</span>
              </label>

              <Button
                type="submit"
                variant="filled"
                color="primary"
                disabled={!selectedFile || uploadMutation.isPending}
                loading={uploadMutation.isPending}
                startIcon={<Upload size={15} />}
              >
                {uploadMutation.isPending ? 'Đang tải lên...' : 'Tải Lên Phụ Đề'}
              </Button>
            </form>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer align="end">
        <Button
          variant="tonal"
          color="secondary"
          onClick={onClose}
        >
          Đóng
        </Button>
      </Modal.Footer>
    </Modal>

    {/* Xác nhận xóa phụ đề (In-app Confirm Modal chuẩn Aesthetic OS) */}
    <ConfirmModal
      open={Boolean(deletingSub)}
      onClose={() => !deleteMutation.isPending && setDeletingSub(null)}
      onConfirm={handleConfirmDelete}
      title="Xác nhận xóa phụ đề"
      content={
        deletingSub
          ? `Bạn có chắc chắn muốn xóa vĩnh viễn phụ đề "${deletingSub.label || deletingSub.language}" (${(deletingSub.language || deletingSub.id)?.toUpperCase()}) khỏi tập phim này không? Hành động này không thể hoàn tác.`
          : ''
      }
      type="danger"
      confirmText="Xóa phụ đề"
      cancelText="Hủy bỏ"
      loading={deleteMutation.isPending}
    />
  </>
);
};


SubtitleManageModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  episode: PropTypes.shape({
    id: PropTypes.string,
    movie_id: PropTypes.string,
    episode_number: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }),
};

export default SubtitleManageModal;

