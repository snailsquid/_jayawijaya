import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedCategory } from '@/pages/SharedCategory';
import { ThemeProvider } from '@/components/theme-provider';

afterEach(()=>vi.restoreAllMocks());
describe('SharedCategory',()=>{
  it('previews ordered members and subscribes',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({category:{id:'c1',name:'GI Set',moduleIds:['m2','m1'],members:[{moduleId:'m2',moduleVersion:1,title:'Second',questionCount:2},{moduleId:'m1',moduleVersion:1,title:'First',questionCount:1}],ownerId:'owner',isOwner:false,visibility:'live',subscribed:false,frozen:false,currentVersion:1,latestVersion:1,localCategoryId:'c1'}}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({category:{}}),{status:201,headers:{'content-type':'application/json'}}));
    render(<ThemeProvider><MemoryRouter initialEntries={['/shared-category/TOKEN']}><Routes><Route path="/shared-category/:token" element={<SharedCategory/>}/><Route path="/start" element={<p>Quiz setup</p>}/></Routes></MemoryRouter></ThemeProvider>);
    expect(await screen.findByText('GI Set')).toBeInTheDocument();
    const items=screen.getAllByRole('listitem'); expect(items[0]).toHaveTextContent('Second'); expect(items[1]).toHaveTextContent('First');
    await userEvent.click(screen.getByRole('button',{name:'Add category and modules'}));
    await waitFor(()=>expect(screen.getByText('Quiz setup')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith('/api/categories/shared/TOKEN/subscribe',expect.objectContaining({method:'POST'}));
  });
});
