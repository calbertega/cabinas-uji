package es.cabinasuji.independiente;

import android.app.Activity;
import android.os.*;
import android.net.Uri;
import android.content.Intent;
import android.graphics.Color;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.json.*;

public final class MainActivity extends Activity {
  private static final String ORIGIN="https://appassets.androidplatform.net";
  private static final Set<String> OFFICIAL_HOSTS=new HashSet<>(Arrays.asList("cataleg.uji.es","xmlrpc.uji.es","accounts.google.com"));
  private static final String RECORD="https://cataleg.uji.es/discovery/fulldisplay?docid=alma991004555715806336&context=L&vid=34CVA_UJI%3AVU1&lang=es";
  private final Handler handler=new Handler(Looper.getMainLooper());
  private WebView ui,official;private LinearLayout root,officialPanel;private TextView address;
  private LinearLayout officialError;
  private Button officialRetry;
  private String officialEntry;
  private WebMessagePort bridge;private JSONArray rooms,known;private String navigateSource,readerSource;
  private int epoch=0;private Job job;private boolean resetting=false,signInAttempted=false,destroyed=false;
  private interface Result{void accept(JSONObject value);}
  private static final class Job{final int epoch;final String id,day;final long deadline;int verified=0,transportFailures=0;Job(int n,String i,String d){epoch=n;id=i;day=d;deadline=SystemClock.elapsedRealtime()+900000;}}
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    try{rooms=new JSONArray(asset("rooms.json"));known=new JSONArray();for(int i=0;i<rooms.length();i++)if(rooms.getJSONObject(i).optBoolean("bookingSupported"))known.put(rooms.getJSONObject(i));navigateSource=asset("navigate.js");readerSource=asset("reader.js");}
    catch(Exception e){errorScreen("No se han podido cargar los archivos de la aplicación.");return;}
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);root.setFitsSystemWindows(true);setContentView(root);
    root.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(i.left,i.top,i.right,i.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
    ui=webView();ui.setWebViewClient(new LocalClient());ui.setWebChromeClient(popupClient());root.addView(ui,new LinearLayout.LayoutParams(-1,0,1));
    officialPanel=new LinearLayout(this);officialPanel.setOrientation(LinearLayout.VERTICAL);officialPanel.setVisibility(View.GONE);
    LinearLayout bar=new LinearLayout(this);Button back=new Button(this);back.setText("Volver a cabinas");back.setOnClickListener(v->leaveOfficial());bar.addView(back);address=new TextView(this);address.setTextSize(13);bar.addView(address,new LinearLayout.LayoutParams(0,-2,1));officialPanel.addView(bar);root.addView(officialPanel,new LinearLayout.LayoutParams(-1,0,1));
    officialError=new LinearLayout(this);
    officialError.setOrientation(LinearLayout.VERTICAL);
    int padding=Math.round(24*getResources().getDisplayMetrics().density);
    officialError.setPadding(padding,padding,padding,padding);
    TextView explanation=new TextView(this);
    explanation.setText("No se ha podido conectar con el catálogo de la UJI. Comprueba la conexión o cambia de red y vuelve a intentarlo.");
    explanation.setTextSize(16);
    officialError.addView(explanation);
    officialRetry=new Button(this);
    officialRetry.setText("Reintentar");
    officialRetry.setOnClickListener(v->{if(officialEntry!=null)openLink(officialEntry);});
    officialError.addView(officialRetry);
    officialError.setVisibility(View.GONE);
    officialPanel.addView(officialError,new LinearLayout.LayoutParams(-1,0,1));
    ui.loadUrl(ORIGIN+"/");
  }
  private void errorScreen(String message){LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(24,48,24,24);TextView view=new TextView(this);view.setText(message);panel.addView(view);Button retry=new Button(this);retry.setText("Volver a abrir");retry.setOnClickListener(v->recreate());panel.addView(retry);setContentView(panel);}
  private String asset(String name)throws IOException{try(InputStream in=getAssets().open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return out.toString("UTF-8");}}
  private WebView webView(){WebView view=new WebView(this);WebSettings s=view.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setGeolocationEnabled(false);s.setSupportMultipleWindows(true);s.setJavaScriptCanOpenWindowsAutomatically(false);CookieManager.getInstance().setAcceptThirdPartyCookies(view,false);view.setDownloadListener((a,b,c,d,e)->{});return view;}
  private boolean local(String url){try{Uri u=Uri.parse(url);return ORIGIN.equals(u.getScheme()+"://"+u.getAuthority())&&"/".equals(u.getPath())&&u.getQuery()==null;}catch(Exception e){return false;}}
  private boolean allowed(Uri uri){
    String authority=uri.getEncodedAuthority();
    if(!"https".equals(uri.getScheme())||authority==null)return false;
    authority=authority.toLowerCase(Locale.ROOT);
    if(authority.endsWith(":443"))authority=authority.substring(0,authority.length()-4);
    return OFFICIAL_HOSTS.contains(authority);
  }
  private boolean catalogue(String value){try{Uri u=Uri.parse(value);if(!allowed(u)||!"cataleg.uji.es".equals(u.getHost())||!"34CVA_UJI:VU1".equals(u.getQueryParameter("vid")))return false;if("/discovery/account".equals(u.getPath()))return true;if(!"/discovery/fulldisplay".equals(u.getPath()))return false;for(int i=0;i<known.length();i++)if(("alma"+known.getJSONObject(i).getString("mms")).equals(u.getQueryParameter("docid")))return true;}catch(Exception ignored){}return false;}
  private void openLink(String url){if(catalogue(url)){cancel();loadOfficial(url,url);showOfficial(true);return;}try{Uri u=Uri.parse(url);if("https".equals(u.getScheme())&&u.getUserInfo()==null&&Arrays.asList("www.uji.es","sites.google.com","www.google.com","maps.google.com").contains(u.getHost()))startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}
  private void loadOfficial(String url,String entry){
    ensureOfficial();
    // Retry from the catalogue entry with GET, never from a redirected form or POST.
    officialEntry=entry;
    officialError.setVisibility(View.GONE);
    official.setVisibility(View.VISIBLE);
    official.loadUrl(url);
  }
  private void popupLink(WebView source,String url){if(source==official&&allowed(Uri.parse(url))){official.loadUrl(url);showOfficial(true);}else openLink(url);}
  private WebChromeClient popupClient(){return new WebChromeClient(){@Override public boolean onCreateWindow(WebView view,boolean dialog,boolean gesture,Message result){if(!gesture&&view!=official)return false;final WebView popup=new WebView(MainActivity.this);popup.setWebViewClient(new WebViewClient(){private boolean handled=false;private void route(String url){if(handled||"about:blank".equals(url))return;handled=true;popup.stopLoading();popupLink(view,url);handler.post(popup::destroy);}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){route(r.getUrl().toString());return true;}@Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){route(url);}});((WebView.WebViewTransport)result.obj).setWebView(popup);result.sendToTarget();return true;}@Override public void onPermissionRequest(PermissionRequest r){r.deny();}};}
  private WebResourceResponse blockedNavigation(){
    return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
  }
  private final class LocalClient extends WebViewClient{
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
      Uri u=request.getUrl();if(request.isForMainFrame()&&!local(u.toString()))return blockedNavigation();
      if(!ORIGIN.equals(u.getScheme()+"://"+u.getAuthority()))return null;
      String p=u.getPath(),text,mime;try{
        if("/".equals(p)){text=asset("index.html");mime="text/html";}else if("/app.js".equals(p)){text=asset("app.js");mime="application/javascript";}else if("/api/rooms".equals(p)){text=rooms.toString();mime="application/json";}
        else if("/api/availability".equals(p)){JSONArray values=new JSONArray();String ids=u.getQueryParameter("ids");if(ids!=null)for(String s:ids.split(",")){if(values.length()>=4)break;try{values.put(new JSONObject().put("id",Integer.parseInt(s)).put("error",true).put("reason","access_required").put("events",new JSONArray()));}catch(Exception ignored){}}text=new JSONObject().put("rooms",values).toString();mime="application/json";}else return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
        Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.uji.es https://documents.uji.es; frame-src https://maps.google.com https://www.google.com https://cataleg.uji.es; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");headers.put("X-Content-Type-Options","nosniff");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
      }catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
    }
    @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(!r.isForMainFrame())return false;if(local(r.getUrl().toString()))return false;openLink(r.getUrl().toString());return true;}
    @Override public void onPageFinished(WebView v,String url){if(local(url))attachBridge();}
    @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){rendererGone(v);return true;}
  }
  private void attachBridge(){
    if(bridge!=null)bridge.close();final WebMessagePort[] ports=ui.createWebMessageChannel();bridge=ports[0];final WebMessagePort own=bridge;final String nonce=UUID.randomUUID().toString();
    own.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage m){if(p!=bridge||!local(ui.getUrl())||destroyed)return;try{command(new JSONObject(m.getData()));}catch(Exception ignored){}}});
    ui.evaluateJavascript("window.__cabinasInit("+JSONObject.quote(nonce)+")",unused->{if(bridge==own&&local(ui.getUrl()))ui.postWebMessage(new WebMessage(nonce,new WebMessagePort[]{ports[1]}),Uri.parse(ORIGIN));});
  }
  private void send(JSONObject value){if(bridge!=null&&!destroyed)try{bridge.postMessage(new WebMessage(value.toString()));}catch(Exception ignored){}}
  private JSONObject message(Job j,String type){JSONObject m=new JSONObject();try{m.put("channel","cabinas-uji-extension").put("type",type);if(j!=null)m.put("requestId",j.id).put("date",j.day);}catch(Exception ignored){}return m;}
  private boolean active(Job j){return !destroyed&&!resetting&&job==j&&j.epoch==epoch;}
  private void cancel(){Job old=job;epoch++;job=null;if(old!=null)send(message(old,"cancelled"));}
  private void command(JSONObject m)throws Exception{
    String type=m.optString("type");if("ping".equals(type)){send(message(null,"ready").put("version",2));return;}if("disconnect".equals(type)){reset();return;}if(resetting)return;
    String id=m.optString("requestId"),day=m.optString("date");if(!id.matches("[-a-zA-Z0-9]{8,80}"))return;
    if("cancel".equals(type)){if(job!=null&&job.id.equals(id))cancel();return;}if(!"connect".equals(type))return;
    LocalDate chosen;try{chosen=LocalDate.parse(day);}catch(Exception e){return;}LocalDate today=LocalDate.now(ZoneId.of("Europe/Madrid"));if(chosen.isBefore(today)||chosen.isAfter(today.plusDays(30)))return;
    cancel();Job j=new Job(++epoch,id,day);job=j;signInAttempted=false;send(message(j,"opening"));loadOfficial(RECORD,null);handler.postDelayed(()->advance(j),1000);
  }
  private void ensureOfficial(){if(official!=null)return;official=webView();official.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);officialPanel.addView(official,new LinearLayout.LayoutParams(-1,0,1));official.setWebChromeClient(popupClient());official.setWebViewClient(new WebViewClient(){
    @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return r.isForMainFrame()&&!allowed(r.getUrl());}
    @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
      // WebView skips shouldOverrideUrlLoading for POST and app-initiated loads.
      if(r.isForMainFrame()&&!allowed(r.getUrl()))return blockedNavigation();
      return null;
    }
    @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){Uri destination=Uri.parse(url);if(!allowed(destination)){address.setText("Destino bloqueado");v.stopLoading();return;}address.setText(destination.getHost());}
    @Override public void onReceivedSslError(WebView v,SslErrorHandler h,android.net.http.SslError e){h.cancel();if(job!=null)fail(job,"connection");}
    @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){
      if(v!=official||!r.isForMainFrame())return;
      if(job!=null)fail(job,"connection");
      if(!allowed(r.getUrl())||officialPanel.getVisibility()!=View.VISIBLE)return;
      int code=e.getErrorCode();
      if(code==ERROR_CONNECT||code==ERROR_IO||code==ERROR_HOST_LOOKUP||code==ERROR_TIMEOUT){
        v.setVisibility(View.GONE);
        officialRetry.setVisibility(officialEntry==null?View.GONE:View.VISIBLE);
        officialError.setVisibility(View.VISIBLE);
      }
    }
    @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){rendererGone(v);return true;}
  });}
  private void showOfficial(boolean show){if(ui==null)return;ui.setVisibility(show?View.GONE:View.VISIBLE);officialPanel.setVisibility(show?View.VISIBLE:View.GONE);}
  private void leaveOfficial(){cancel();showOfficial(false);}
  private void rendererGone(WebView view){
    Job old=job;if(old!=null){try{send(message(old,"error").put("code","connection").put("tabKept",false));}catch(Exception ignored){}}epoch++;job=null;
    if(view==official){officialPanel.removeView(view);view.destroy();official=null;showOfficial(false);}
    else{if(bridge!=null){bridge.close();bridge=null;}root.removeView(view);view.destroy();ui=null;errorScreen("El navegador de Android se ha cerrado. Pulsa Volver a abrir para recuperar la aplicación.");}
  }
  private void fail(Job j,String code){if(!active(j))return;JSONObject m=message(j,"error");try{m.put("code",code).put("tabKept",true);}catch(Exception ignored){}send(m);job=null;showOfficial(true);}
  private void advance(Job j){
    if(!active(j))return;if(SystemClock.elapsedRealtime()>j.deadline){fail(j,"timeout");return;}if(official==null){fail(j,"connection");return;}
    String value=official.getUrl();if(value==null){handler.postDelayed(()->advance(j),500);return;}Uri u=Uri.parse(value);
    if(!"cataleg.uji.es".equals(u.getHost())){showOfficial(true);send(message(j,"login"));handler.postDelayed(()->advance(j),1500);return;}
    String p=u.getPath();if("/view/calendar/Calendar.html".equals(p)||"/view/uresolver/34CVA_UJI/bookingAvailability".equals(p)){send(message(j,"reading"));collect(j,0,0);return;}
    if(p==null||!p.startsWith("/discovery/")){handler.postDelayed(()->advance(j),1000);return;}
    evaluate(j,navigateSource,"advanceUjiCalendar("+(!signInAttempted)+")",16000,result->{
      if(!active(j))return;String stage=result.optString("stage");
      if("ready".equals(stage)){send(message(j,"reading"));collect(j,0,0);}else if("calendar_missing".equals(stage)){fail(j,"calendar_missing");}
      else{if("navigating".equals(stage))signInAttempted=true;if("navigating".equals(stage)||"login".equals(stage)){showOfficial(true);send(message(j,"login"));}handler.postDelayed(()->advance(j),1000);}
    });
  }
  private void evaluate(Job j,String source,String expression,long timeout,Result callback){
    final String key="__cabinas_"+UUID.randomUUID().toString().replace("-","");final long until=SystemClock.elapsedRealtime()+timeout;
    if(!active(j)||official==null)return;
    official.evaluateJavascript("(function(){const key="+JSONObject.quote(key)+";"+source+";Promise.resolve("+expression+").then(v=>{window[key]={value:v};},()=>{window[key]={failed:true};});})();",null);
    Runnable poll=new Runnable(){@Override public void run(){
      if(!active(j)||official==null)return;
      String current=official.getUrl();if(current==null||!current.startsWith("https://cataleg.uji.es/")){callback.accept(new JSONObject());return;}
      if(SystemClock.elapsedRealtime()>until){callback.accept(new JSONObject());return;}
      official.evaluateJavascript("JSON.stringify(window["+JSONObject.quote(key)+"]||null)",raw->{
        if(!active(j))return;try{Object decoded=new JSONTokener(raw).nextValue();if(decoded instanceof String&&!"null".equals(decoded)){JSONObject envelope=new JSONObject((String)decoded);official.evaluateJavascript("delete window["+JSONObject.quote(key)+"]",null);JSONObject result=envelope.optJSONObject("value");callback.accept(result==null?new JSONObject():result);return;}}catch(Exception ignored){}handler.postDelayed(this,200);
      });
    }};handler.postDelayed(poll,200);
  }
  private JSONObject normalize(JSONObject value,int id,String day){try{
    if(!Boolean.TRUE.equals(value.opt("ok"))||value.getInt("room")!=id||!day.equals(value.getString("date")))return null;long time=Instant.parse(value.getString("fetchedAt")).toEpochMilli(),age=System.currentTimeMillis()-time;if(age< -60000||age>=120000)return null;
    JSONArray input=value.getJSONArray("events"),output=new JSONArray();if(input.length()>1000)return null;for(int i=0;i<input.length();i++){JSONObject e=input.getJSONObject(i);double a=e.getDouble("start"),b=e.getDouble("end");String type=e.getString("type");if(!Double.isFinite(a)||!Double.isFinite(b)||a<0||b>24||b<a||!Arrays.asList("closed","unavailable").contains(type))return null;output.put(new JSONObject().put("start",a).put("end",b).put("type",type));}return new JSONObject().put("id",id).put("fetchedAt",value.getString("fetchedAt")).put("events",output);
  }catch(Exception e){return null;}}
  private void collect(Job j,int index,int attempt){
    if(!active(j))return;if(SystemClock.elapsedRealtime()>j.deadline){fail(j,"timeout");return;}
    if(index>=known.length()){if(j.verified==0){fail(j,"unverified");return;}try{send(message(j,"done").put("verified",j.verified).put("total",known.length()));}catch(Exception ignored){}job=null;showOfficial(false);return;}
    final int id=known.optJSONObject(index).optInt("id");
    evaluate(j,readerSource,"readUjiCalendar("+JSONObject.quote(j.day)+","+known.toString()+","+id+")",20000,value->{
      if(!active(j))return;JSONObject item=normalize(value,id,j.day);String code=value.optString("code","connection");
      if(item==null&&"connection".equals(code)&&attempt==0){handler.postDelayed(()->collect(j,index,1),500);return;}
      if(item!=null){j.verified++;j.transportFailures=0;}else if("connection".equals(code))j.transportFailures++;else j.transportFailures=0;
      try{if(item==null)item=new JSONObject().put("id",id).put("error",true).put("reason","calendar_unverified").put("events",new JSONArray());send(message(j,"progress").put("done",index+1).put("total",known.length()).put("room",item));}catch(Exception ignored){}
      if(j.transportFailures>=3){fail(j,"connection");return;}collect(j,index+1,0);
    });
  }
  private void reset(){
    if(resetting)return;cancel();resetting=true;send(resetMessage("started"));
    officialEntry=null;
    officialError.setVisibility(View.GONE);
    if(official!=null){official.stopLoading();officialPanel.removeView(official);official.destroy();official=null;}WebStorage.getInstance().deleteAllData();WebViewDatabase.getInstance(this).clearHttpAuthUsernamePassword();ui.clearCache(true);
    CookieManager.getInstance().removeAllCookies(unused->{CookieManager.getInstance().flush();resetting=false;send(resetMessage("complete"));showOfficial(false);ui.loadUrl(ORIGIN+"/");});
  }
  private JSONObject resetMessage(String phase){JSONObject m=new JSONObject();try{m.put("type","session_reset").put("phase",phase);}catch(Exception ignored){}return m;}
  @Override public void onBackPressed(){if(officialPanel!=null&&officialPanel.getVisibility()==View.VISIBLE){leaveOfficial();return;}super.onBackPressed();}
  @Override protected void onStop(){super.onStop();CookieManager.getInstance().flush();}
  @Override protected void onDestroy(){destroyed=true;epoch++;job=null;handler.removeCallbacksAndMessages(null);if(bridge!=null)bridge.close();if(official!=null)official.destroy();if(ui!=null)ui.destroy();super.onDestroy();}
}
