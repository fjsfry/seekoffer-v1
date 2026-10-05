import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResourceProductDetail } from '@/components/resource-product-detail';
import { resourceProductSeeds } from '@/lib/resource-products';

export function generateStaticParams() {
  return resourceProductSeeds.map(product => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = resourceProductSeeds.find(item => item.slug === slug);
  if (!product) return { title: '资源不存在 - Seekoffer' };
  return {
    title: `${product.title} - Seekoffer 申请资料中心`,
    description: product.summary,
    alternates: { canonical: `/resources/${product.slug}` },
    openGraph: {
      title: `${product.title} - Seekoffer`,
      description: product.summary,
      url: `/resources/${product.slug}`,
      siteName: '寻鹿 SeekOffer',
      images: ['/logo.png'],
      locale: 'zh_CN',
      type: 'website'
    }
  };
}

export default async function ResourceProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!resourceProductSeeds.some(product => product.slug === slug)) notFound();
  return <ResourceProductDetail slug={slug} />;
}
