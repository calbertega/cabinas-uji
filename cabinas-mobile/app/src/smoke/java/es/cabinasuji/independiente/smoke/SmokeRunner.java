package es.cabinasuji.independiente.smoke;

import android.app.*;
import android.os.Bundle;
import android.content.Intent;
import android.view.*;
import android.webkit.*;
import java.io.ByteArrayInputStream;
import java.lang.reflect.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

// Tests the installed Android app, not a desktop DOM imitation. It never logs
// in, reads an account or sends a booking. Live UJI validation is separate.
public final class SmokeRunner extends Instrumentation {
  private static final String FIXTURE_URL="https://cataleg.uji.es/view/calendar/Calendar.html?cabinas_smoke_fixture=1";
  private static final String BLOCKED_URL="https://cataleg.uji.es.invalid/cabinas-post-fixture";
  private Activity activity;private WebView ui;private int passed;
  @Override public void onCreate(Bundle args){super.onCreate(args);start();}
  private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup group=(ViewGroup)v;for(int i=0;i<group.getChildCount();i++){WebView w=find(group.getChildAt(i));if(w!=null)return w;}}return null;}
  private void check(boolean value,String label){if(!value)throw new AssertionError(label);passed++;}
  private String js(WebView target,String expression)throws Exception{CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();runOnMainSync(()->target.evaluateJavascript(expression,v->{result.set(v);latch.countDown();}));if(!latch.await(5,TimeUnit.SECONDS))throw new AssertionError("WebView callback timeout");return result.get();}
  private String js(String expression)throws Exception{return js(ui,expression);}
  private WebView official()throws Exception{java.lang.reflect.Field field=activity.getClass().getDeclaredField("official");field.setAccessible(true);return (WebView)field.get(activity);}
  private void createOfficial(){runOnMainSync(()->{try{java.lang.reflect.Method method=activity.getClass().getDeclaredMethod("ensureOfficial");method.setAccessible(true);method.invoke(activity);}catch(Exception e){throw new RuntimeException(e);}});}
  private boolean waitFor(WebView target,String expression)throws Exception{long until=System.currentTimeMillis()+15000;while(System.currentTimeMillis()<until){if("true".equals(js(target,expression)))return true;Thread.sleep(200);}return false;}
  private boolean waitFor(String expression)throws Exception{long until=System.currentTimeMillis()+15000;while(System.currentTimeMillis()<until){if("true".equals(js(expression)))return true;Thread.sleep(200);}return false;}
  private void checkSearchFlow()throws Exception{
    js("window.__smokeRequests=[];cabinasDesktop.send=m=>{if(m.type==='connect')__smokeRequests.push(m)};"
      +"window.__completeSearch=()=>{const r=__smokeRequests.at(-1);const emit=m=>postMessage({channel:'cabinas-uji-extension',requestId:r.requestId,date:r.date,...m},location.origin);"
      +"for(const [id,events] of [[207,[{start:8,end:10,type:'unavailable'}]],[209,[]]])emit({type:'progress',room:{id,events,fetchedAt:new Date().toISOString()}});emit({type:'done'});};"
      +"document.querySelector('#date').value=addDays(today,1);document.querySelector('#start').value='8';document.querySelector('#filters').requestSubmit();true");
    check(waitFor("__smokeRequests.length===1"),"Searching can start a native consultation directly");
    js("__completeSearch();true");
    check(waitFor("!loading&&document.querySelector('#cards [data-room]').dataset.room==='209'"),"Confirmed free rooms are sorted before unavailable rooms");
    check("true".equals(js("document.querySelector('#connector-connect').hidden&&document.querySelector('#account-label').textContent==='Mi cuenta'&&localStorage.getItem('cabinas-uji.auto-check')==='1'")),"Successful results keep the account compact and remember automatic consultation");
    js("document.querySelector('#filters').requestSubmit();document.querySelector('#filters').requestSubmit();true");
    check(waitFor("__smokeRequests.length===2"),"Another search requests fresh availability for the same day");
    check("true".equals(js("__smokeRequests.length===2&&loading&&currentCalendar(rooms.find(r=>r.id===209))!==null")),"An ongoing search is reused and recent results stay visible");
    js("__completeSearch();true");
    check(waitFor("!loading"),"Second search completes");
    js("lastLoadAt=Date.now()-120001;checkFreshness();true");
    check(waitFor("__smokeRequests.length===3"),"Active session refreshes when the last consultation ages out");
    js("personalConnector.resetLocal();true");
    check("true".equals(js("localStorage.getItem('cabinas-uji.auto-check')===null&&!document.querySelector('#connector-connect').hidden")),"Local sign-out resets the remembered consultation and connection controls");
  }
  private void checkCalendarReturn(WebView view){
    runOnMainSync(()->{
      try{
        Class<?> type=activity.getClass();
        Class<?> jobType=Class.forName(type.getName()+"$Job");
        Field epoch=type.getDeclaredField("epoch"),job=type.getDeclaredField("job"),reader=type.getDeclaredField("readerSource");
        Method show=type.getDeclaredMethod("showOfficial",boolean.class),advance=type.getDeclaredMethod("advance",jobType),fail=type.getDeclaredMethod("fail",jobType,String.class);
        Constructor<?> constructor=jobType.getDeclaredConstructor(int.class,String.class,String.class);
        for(AccessibleObject member:new AccessibleObject[]{epoch,job,reader,show,advance,fail,constructor})member.setAccessible(true);
        Object pending=constructor.newInstance(epoch.getInt(activity),"return-fixture","2000-01-01");
        job.set(activity,pending);
        reader.set(activity,"function readUjiCalendar(){return new Promise(()=>{});}");
        show.invoke(activity,true);
        check(view.isShown()&&!ui.isShown(),"Official screen is visible before the calendar is read");
        advance.invoke(activity,pending);
        check(ui.isShown()&&!view.isShown()&&job.get(activity)==pending,"App returns automatically while calendar reads are still pending");
        fail.invoke(activity,pending,"connection");
        check(ui.isShown()&&!view.isShown(),"A background calendar error does not reopen the official screen");
      }catch(ReflectiveOperationException e){throw new AssertionError("Calendar return fixture failed",e);}
    });
  }
  private void loadFixture(WebView view,CountDownLatch postIntercepted,AtomicReference<Integer> postStatus){
    runOnMainSync(()->{
      WebViewClient policy=view.getWebViewClient();
      view.setWebViewClient(new WebViewClient(){
        @Override public WebResourceResponse shouldInterceptRequest(WebView current,WebResourceRequest request){
          WebResourceResponse response=policy.shouldInterceptRequest(current,request);
          String url=request.getUrl().toString();
          if(postIntercepted!=null&&request.isForMainFrame()&&"POST".equals(request.getMethod())&&BLOCKED_URL.equals(url)){
            postStatus.set(response==null?null:response.getStatusCode());
            postIntercepted.countDown();
          }
          if(response==null&&FIXTURE_URL.equals(url))return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(new byte[0]));
          return response;
        }
      });
      view.loadUrl(FIXTURE_URL);
    });
  }
  @Override public void onStart(){Bundle report=new Bundle();try{
    Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);activity=startActivitySync(launch);
    runOnMainSync(()->ui=find(activity.getWindow().getDecorView()));check(ui!=null,"Local WebView exists");
    check(waitFor("typeof rooms!=='undefined'&&rooms.length>=39"),"Assets and local inventory loaded");
    check(waitFor("document.querySelector('#connector-message').textContent.includes('Lista para conectar')"),"Native initial handshake completed");
    check(waitFor("document.querySelector('#free-count').textContent==='Sin verificar'"),"No fabricated availability after initial loading; actual="+js("document.querySelector('#free-count').textContent"));
    check("true".equals(js("!document.querySelector('#connector-connect').disabled")),"Connect button enabled");
    check("true".equals(js("document.querySelector('#local-signout')!==null")),"Local sign out available");
    js("window.__smokeReady=false;window.cabinasDesktop.onMessage(m=>{if(m.type==='ready')window.__smokeReady=true;});window.cabinasDesktop.send({type:'ping'});true");
    check(waitFor("window.__smokeReady===true"),"Message port makes a real native round trip");
    runOnMainSync(()->{check(!ui.getSettings().getAllowFileAccess(),"File access disabled");check(!ui.getSettings().getAllowContentAccess(),"Content access disabled");check(ui.getSettings().getMixedContentMode()==WebSettings.MIXED_CONTENT_NEVER_ALLOW,"Mixed content disabled");});
    createOfficial();final WebView oldOfficial=official();check(oldOfficial!=null,"Official context created");
    CountDownLatch postIntercepted=new CountDownLatch(1);
    AtomicReference<Integer> postStatus=new AtomicReference<>();
    loadFixture(oldOfficial,postIntercepted,postStatus);
    check(waitFor(oldOfficial,"location.origin==='https://cataleg.uji.es'"),"Synthetic context has the intended origin");
    check("true".equals(js(oldOfficial,"typeof window.cabinasDesktop==='undefined'")),"Official context has no native bridge");
    runOnMainSync(()->oldOfficial.postUrl(BLOCKED_URL,new byte[]{'t','e','s','t'}));
    check(postIntercepted.await(10,TimeUnit.SECONDS)&&Integer.valueOf(403).equals(postStatus.get()),"A real main-frame WebView POST to an unapproved origin is intercepted with 403");
    runOnMainSync(()->oldOfficial.loadUrl(FIXTURE_URL));
    check(waitFor(oldOfficial,"location.origin==='https://cataleg.uji.es'"),"Official context recovers after blocked navigation");
    js(oldOfficial,"localStorage.setItem('__cabinas_test_account','A');window.__fixtureDbReady=false;var fixtureDb=indexedDB.open('__cabinas_test_database',1);fixtureDb.onupgradeneeded=()=>fixtureDb.result.createObjectStore('values');fixtureDb.onsuccess=()=>{fixtureDb.result.close();window.__fixtureDbReady=true;};true");
    check(waitFor(oldOfficial,"window.__fixtureDbReady===true&&localStorage.getItem('__cabinas_test_account')==='A'"),"Synthetic local storage and IndexedDB exist");
    CountDownLatch cookieReady=new CountDownLatch(1);runOnMainSync(()->CookieManager.getInstance().setCookie("https://cataleg.uji.es/","__cabinas_test=synthetic-only; Secure; HttpOnly; SameSite=Lax; Path=/",done->cookieReady.countDown()));
    check(cookieReady.await(5,TimeUnit.SECONDS)&&String.valueOf(CookieManager.getInstance().getCookie("https://cataleg.uji.es/")).contains("__cabinas_test=synthetic-only"),"Synthetic session cookie created locally");
    js("window.__smokeBeforeReset=true;window.cabinasDesktop.send({type:'disconnect'});true");
    check(waitFor("typeof window.__smokeBeforeReset==='undefined'&&document.querySelector('#connector-message').textContent.includes('Lista para conectar')&&!document.querySelector('#connector-connect').disabled"),"Local reset reloads and reconnects native bridge");
    check(!String.valueOf(CookieManager.getInstance().getCookie("https://cataleg.uji.es/")).contains("__cabinas_test="),"Native Android reset removes its session cookie");
    check(official()==null,"Reset discards the previous official page and reader context");createOfficial();final WebView freshOfficial=official();check(freshOfficial!=oldOfficial,"A new connection gets a distinct official WebView");
    loadFixture(freshOfficial,null,null);
    check(waitFor(freshOfficial,"location.origin==='https://cataleg.uji.es'&&localStorage.getItem('__cabinas_test_account')===null"),"Previous account local storage does not reappear");
    js(freshOfficial,"window.__fixtureDbEmpty=false;indexedDB.databases().then(values=>window.__fixtureDbEmpty=!values.some(v=>v.name==='__cabinas_test_database'));true");
    check(waitFor(freshOfficial,"window.__fixtureDbEmpty===true"),"Previous account IndexedDB does not reappear");
    checkCalendarReturn(freshOfficial);
    checkSearchFlow();
    report.putString("stream","PASS: "+passed+" Android runtime smoke checks. No live UJI session tested.\n");finish(Activity.RESULT_OK,report);
  }catch(Throwable error){report.putString("stream","FAIL after "+passed+" checks: "+error.getClass().getSimpleName()+": "+error.getMessage()+"\n");finish(Activity.RESULT_CANCELED,report);}}
}
