'use client';

// Adapted from Stackzero Commerce UI (MIT); see licenses/stackzero-commerce-ui.txt.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import type { ProductImage } from '@/lib/resource-product-media';
import s from './product.module.css';

const ImageViewer = dynamic(() => import('./image-viewer'));

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [viewport, carousel] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [viewer, setViewer] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const onSelect = useCallback(() => {
    if (carousel) setSelected(carousel.selectedScrollSnap());
  }, [carousel]);
  useEffect(() => {
    if (!carousel) return;
    onSelect();
    carousel.on('select', onSelect).on('reInit', onSelect);
    return () => { carousel.off('select', onSelect).off('reInit', onSelect); };
  }, [carousel, onSelect]);

  return <section className={s.gallery} aria-label="商品图片" aria-roledescription="轮播">
    <div className={s.galleryStage} onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); carousel?.scrollPrev(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); carousel?.scrollNext(); }
    }}>
      <div ref={viewport} className={s.galleryViewport}>
        <div className={s.galleryTrack}>
          {images.map((image, index) => <div className={s.gallerySlide} key={image.src} role="group" aria-label={'第 ' + (index + 1) + ' 张，共 ' + images.length + ' 张'}>
            <button type="button" tabIndex={index === selected ? 0 : -1} className={s.imageButton}
              aria-label={'放大查看：' + image.alt}
              onClick={event => { opener.current = event.currentTarget; setViewer(true); }}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height}
                priority={index === 0} loading={index === 0 ? undefined : 'lazy'} draggable={false} sizes="(max-width: 767px) 100vw, 540px" />
            </button>
          </div>)}
        </div>
      </div>
    </div>
    <div className={s.galleryCaption}>
      <div className={s.galleryControls}>
        <button type="button" onClick={() => carousel?.scrollPrev()} aria-label="上一张商品图"><ChevronLeft size={15} /></button>
        <span className={s.imageCount} aria-live="polite">{selected + 1} / {images.length}</span>
        <button type="button" onClick={() => carousel?.scrollNext()} aria-label="下一张商品图"><ChevronRight size={15} /></button>
      </div>
      <span className={s.zoomHint}><Expand size={13} />点击图片放大</span>
    </div>
    <div className={s.thumbnails} aria-label="选择商品图片">
      {images.map((image, index) => <button key={image.src} type="button" aria-label={image.alt} aria-pressed={selected === index}
        className={s.thumbnail} onClick={() => carousel?.scrollTo(index)}>
        <Image src={image.thumbnail || image.src} alt="" width={100} height={100} draggable={false} />
      </button>)}
    </div>
    {viewer ? <ImageViewer images={images} initialIndex={selected} open onOpenChange={setViewer} returnFocus={opener.current} /> : null}
  </section>;
}
