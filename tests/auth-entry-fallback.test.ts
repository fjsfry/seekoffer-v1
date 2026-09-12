import {it,expect,vi,afterEach} from 'vitest';
import {portalUrlFromReferrer} from '../lib/clerk-portal-url';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('preserves legitimate return filters while discarding auth secrets and foreign return origins',()=>{
 const result=new URL(portalUrlFromReferrer('https://www.seekoffer.com.cn/notices/?q=北京&page=3&access_token=private&redirect_url=https://evil.invalid'));
 expect(result.origin).toBe('https://accounts.seekoffer.com.cn');const target=new URL(result.searchParams.get('redirect_url')!);expect(target.searchParams.get('q')).toBe('北京');expect(target.searchParams.get('page')).toBe('3');expect(target.searchParams.has('access_token')).toBe(false);expect(target.searchParams.has('redirect_url')).toBe(false);
 for(const bad of [null,'https://evil.invalid/','https://www.seekoffer.com.cn.evil.invalid/','javascript:alert(1)','https://www.seekoffer.com.cn/auth/sign-in/'])expect(new URL(portalUrlFromReferrer(bad)).searchParams.get('redirect_url')).toBe('https://www.seekoffer.com.cn/me/');
});
it('a login click before the modal listener mounts is handled once after mounting',async()=>{
 vi.stubGlobal('window',new EventTarget());const {openAuthModal,watchAuthModal}=await import('../lib/auth-intent');
 const intent={type:'open-workspace' as const,returnTo:'/me'};openAuthModal(intent);const show=vi.fn();const stop=watchAuthModal(show);expect(show).toHaveBeenCalledExactlyOnceWith(intent);stop();const next=vi.fn();watchAuthModal(next)();expect(next).not.toHaveBeenCalled();
});
it('ordinary modal clicks are not replayed after listener replacement',async()=>{
 vi.stubGlobal('window',new EventTarget());const {openAuthModal,watchAuthModal}=await import('../lib/auth-intent');
 const show=vi.fn();const stop=watchAuthModal(show);openAuthModal();expect(show).toHaveBeenCalledExactlyOnceWith(null);stop();const next=vi.fn();watchAuthModal(next)();expect(next).not.toHaveBeenCalled();
});
