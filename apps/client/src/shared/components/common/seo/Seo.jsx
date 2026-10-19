/**
 * @file Seo.jsx
 * @module Components/Common/Seo/Seo
 * @component Seo
 * @description Component quản lý các thẻ Meta SEO toàn cục (Title, Meta Description, OpenGraph, Canonical URL & Robots) bằng react-helmet-async.
 */

import { Helmet } from "react-helmet-async";

const SITE_NAME = "Sạp Phim";
const DEFAULT_DESCRIPTION =
    "Xem phim và anime trực tuyến chất lượng cao, cập nhật nhanh chóng, tối ưu cho mọi thiết bị và trải nghiệm xem mượt mà tại Sạp Phim.";
const DEFAULT_IMAGE = "/images/placeholder-banner.png";

const getAbsoluteUrl = (path) => {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;

    const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");

    return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
};

const Seo = ({
    title,
    description = DEFAULT_DESCRIPTION,
    canonicalPath,
    image = DEFAULT_IMAGE,
    type = "website",
    noIndex = false,
}) => {
    const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = getAbsoluteUrl(canonicalPath);
    const imageUrl = getAbsoluteUrl(image);

    return (
        <Helmet>
            <title>{pageTitle}</title>
            <meta name="description" content={description} />
            {noIndex && <meta name="robots" content="noindex,nofollow" />}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            <meta property="og:type" content={type} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={description} />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
            {imageUrl && <meta property="og:image" content={imageUrl} />}

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={pageTitle} />
            <meta name="twitter:description" content={description} />
            {imageUrl && <meta name="twitter:image" content={imageUrl} />}
        </Helmet>
    );
};

export default Seo;
