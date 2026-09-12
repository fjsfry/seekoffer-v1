import {NextResponse,type NextRequest} from 'next/server';
export function middleware(request:NextRequest){
 if(process.env.NEXT_PUBLIC_WEBSITE_RECOVERY==='true'&&(request.nextUrl.pathname.startsWith('/download/windows/')||request.nextUrl.pathname==='/api/desktop-download/windows'||request.nextUrl.pathname==='/api/desktop-download/windows/')){
  const url=request.nextUrl.clone();url.pathname='/download/';url.search='';return NextResponse.redirect(url,303);
 }
 if(process.env.NEXT_PUBLIC_WEBSITE_RECOVERY!=='true'||process.env.NEXT_PUBLIC_COMMUNITY_RECOVERY==='true')return NextResponse.next();
 const url=request.nextUrl.clone();url.pathname='/maintenance';url.search='';return NextResponse.rewrite(url);
}
export const config={matcher:['/admin/:path*','/offers/:path*','/publish/:path*','/download/windows/:path*','/api/desktop-download/windows/:path*']};
