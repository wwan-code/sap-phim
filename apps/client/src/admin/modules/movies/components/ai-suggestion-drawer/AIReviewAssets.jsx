/**
 * @file AIReviewAssets.jsx
 * @module Admin/Movies/Components
 * @description Reference images retain source links and explicit URL copying only.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Copy, ExternalLink } from 'lucide-react';

/** @component AIReviewAssets @description Render source assets without applying or uploading images. */
const AIReviewAssets = ({ assets, copy, copiedUrl }) => <div className="sp-ai-drawer__asset-groups">
  <p className="sp-ai-drawer__muted">Ảnh tham khảo từ nguồn. Mở ảnh để kiểm tra hoặc sao chép URL khi cần.</p>
  {assets.map((group) => <section key={group.kind}><h3>{group.label}</h3><div className="sp-ai-drawer__assets">{group.items.map((asset, index) => <article className="sp-ai-drawer__asset" key={asset.url + index}><a href={asset.url} target="_blank" rel="noopener noreferrer"><img src={asset.url} loading="lazy" alt={asset.label || group.label} /><span>{asset.source || group.label}<ExternalLink size={12} aria-hidden="true" /></span></a><button type="button" onClick={() => copy(asset.url)} aria-label={'Sao chép URL ' + (asset.label || group.label)}><Copy size={14} aria-hidden="true" />{copiedUrl === asset.url ? 'Đã sao chép' : 'Sao chép URL'}</button></article>)}</div></section>)}
</div>;
AIReviewAssets.propTypes = { assets: PropTypes.array.isRequired, copy: PropTypes.func.isRequired, copiedUrl: PropTypes.string };
export default AIReviewAssets;
