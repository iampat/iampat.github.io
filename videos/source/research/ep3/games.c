// Generates the sample games for episode 3 as JSON (3x3 boxes, extra-turn rule).
// g1: Tavi (first) plays greedy, Chalk (second) plays perfectly.
// g5: Chalk (first) plays perfectly with g1's first line, Tavi (second) plays perfectly.
// Build: gcc -O2 -o games games.c && ./games > games.json
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define N 3
#define NH ((N+1)*N)
#define NV (N*(N+1))
#define L (NH+NV)
#define FULL ((1u<<L)-1)
static signed char *memo; static unsigned char *seen;
static int boxmask[N*N];
static int H(int r,int c){return r*N+c;} static int V(int r,int c){return NH+r*(N+1)+c;}
static int completed(unsigned m,int line){int k=0;for(int b=0;b<N*N;b++) if((boxmask[b]>>line&1)&&(m&boxmask[b])==(unsigned)boxmask[b])k++;return k;}
static int sides(unsigned m,int b){return __builtin_popcount(m&boxmask[b]);}
static int solve(unsigned m){
  if(m==FULL) return 0;
  if(seen[m]) return memo[m];
  int best=-100;
  for(int l=0;l<L;l++){ if(m>>l&1) continue; unsigned m2=m|(1u<<l); int c=completed(m2,l);
    int v = c>0 ? c+solve(m2) : c-solve(m2); if(v>best) best=v; }
  seen[m]=1; memo[m]=best; return best;
}
static int moveValue(unsigned m,int l){unsigned m2=m|(1u<<l);int c=completed(m2,l);return c>0?c+solve(m2):c-solve(m2);}
// a line is "safe" if it gives no box a third side (and completes nothing)
static int isSafe(unsigned m,int l){unsigned m2=m|(1u<<l);for(int b=0;b<N*N;b++) if((boxmask[b]>>l&1)&&sides(m2,b)>=3) return 0;return 1;}
static int safeCount(unsigned m){int k=0;for(int l=0;l<L;l++) if(!(m>>l&1)&&isSafe(m,l))k++;return k;}
static int canCapture(unsigned m){for(int l=0;l<L;l++) if(!(m>>l&1)&&completed(m|(1u<<l),l)>0) return 1;return 0;}
// boxes the opponent could grab greedily right after this move
static int giveaway(unsigned m){int k=0;unsigned mm=m;int again=1;while(again){again=0;for(int l=0;l<L;l++){if(mm>>l&1)continue;int c=completed(mm|(1u<<l),l);if(c>0){mm|=1u<<l;k+=c;again=1;}}}return k;}
static unsigned rng=12345u; static unsigned rnd(void){rng=rng*1103515245u+12345u;return rng>>8;}
static int greedyMove(unsigned m){
  int best=-1,bc=0; for(int l=0;l<L;l++){if(m>>l&1)continue;int c=completed(m|(1u<<l),l);if(c>bc){bc=c;best=l;}}
  if(best>=0) return best;
  int cand[L],n=0; for(int l=0;l<L;l++) if(!(m>>l&1)&&isSafe(m,l)) cand[n++]=l;
  if(n) return cand[rnd()%n];
  int bl=-1,bg=99; for(int l=0;l<L;l++){if(m>>l&1)continue;int g=giveaway(m|(1u<<l));if(g<bg){bg=g;bl=l;}} return bl;
}
// perfect move; tie-break: prefer safe lines, then prefer NOT capturing when a decline is also optimal (shows control), then lowest index
static int randomPerfect(unsigned m){
  int best=-100; for(int l=0;l<L;l++) if(!(m>>l&1)){int v=moveValue(m,l);if(v>best)best=v;}
  int cand[L],n=0; for(int l=0;l<L;l++) if(!(m>>l&1)&&moveValue(m,l)==best) cand[n++]=l; return cand[rnd()%n]; }
static int perfectMove(unsigned m,int preferDecline){
  int best=-100; for(int l=0;l<L;l++) if(!(m>>l&1)){int v=moveValue(m,l);if(v>best)best=v;}
  int pick=-1,ps=-1;
  for(int l=0;l<L;l++){ if(m>>l&1) continue; if(moveValue(m,l)!=best) continue;
    int c=completed(m|(1u<<l),l); int s=isSafe(m,l)?3:(preferDecline&&c==0?2:(c>0?1:0));
    if(s>ps){ps=s;pick=l;} }
  return pick;
}
typedef struct{int p,line,got,sc[2],safeBefore,couldCapture,gave;}Move;
static int randomMode=0; static unsigned startMask=0; static int greedyOnce=0;
static int play(int first,int greedyPlayer,int forcedFirst,Move*mv,int*score){
  unsigned m=startMask;int p=first,n=0;score[0]=score[1]=0;
  while(m!=FULL){ int l;
    if(n==0&&forcedFirst>=0) l=forcedFirst; else if(greedyOnce&&n==0) l=greedyMove(m); else l=(p==greedyPlayer)?greedyMove(m):(randomMode?randomPerfect(m):perfectMove(m,1));
    Move*x=&mv[n++]; x->p=p;x->line=l;x->safeBefore=safeCount(m);x->couldCapture=canCapture(m);
    unsigned m2=m|(1u<<l); x->got=completed(m2,l); score[p]+=x->got; x->sc[0]=score[0];x->sc[1]=score[1];
    x->gave=x->got?0:giveaway(m2); m=m2; if(x->got==0) p^=1; }
  return n;
}
static void printGame(const char*name,const char*who0,Move*mv,int n,int*score){
  printf("  \"%s\": {\"first\": \"%s\", \"final\": [%d, %d], \"moves\": [\n",name,who0,score[0],score[1]);
  for(int i=0;i<n;i++){Move*x=&mv[i];int l=x->line;
    printf("    {\"n\": %d, \"p\": %d, \"line\": \"%c%d%d\", \"idx\": %d, \"got\": %d, \"score\": [%d, %d], \"safeBefore\": %d, \"couldCapture\": %d, \"gave\": %d}%s\n",
      i+1,x->p,l<NH?'h':'v',l<NH?l/N:(l-NH)/(N+1),l<NH?l%N:(l-NH)%(N+1),l,x->got,x->sc[0],x->sc[1],x->safeBefore,x->couldCapture,x->gave,i<n-1?",":"");}
  printf("  ]}");
}
int main(void){
  for(int i=0;i<N;i++)for(int j=0;j<N;j++) boxmask[i*N+j]=(1<<H(i,j))|(1<<H(i+1,j))|(1<<V(i,j))|(1<<V(i,j+1));
  memo=malloc(1u<<L); seen=calloc(1u<<L,1); solve(0);
  Move g1[L]; int s1[2],n1=0,bestSeed=-1,bestScore=-1;
  // search seeds for a greedy game where Tavi (p0) leads 3-0 at some point, ends 3-6, Chalk declines a capture at least once
  for(unsigned seed=1;seed<4000;seed++){ rng=seed; Move mv[L];int sc[2];int n=play(0,0,-1,mv,sc);
    int led3=0,declines=0,earlyGift=0; for(int i=0;i<n;i++){ if(mv[i].sc[0]>=3&&mv[i].sc[1]==0) led3=1; if(mv[i].p==1&&mv[i].couldCapture&&mv[i].got==0) declines++; if(mv[i].p==1&&!mv[i].couldCapture&&mv[i].safeBefore>0&&!isSafe(0,0)&&mv[i].gave>0) earlyGift++; }
    int score=(sc[1]==6)*10+led3*5+(declines>0)*3+(earlyGift>0)*2;
    if(score>bestScore){bestScore=score;bestSeed=seed;memcpy(g1,mv,sizeof(mv));n1=n;s1[0]=sc[0];s1[1]=sc[1];}
    if(score>=20) break; }
  int first=g1[0].line;
  Move g5[L]; int s5[2]; int n5=0; int bs=-1; unsigned g5seed=0; int declineAt=-1;
  randomMode=1;
  for(unsigned seed=1;seed<20000;seed++){ rng=seed; Move mv[L];int sc[2];int n=play(1,-1,first,mv,sc);
    int dec=-1,early=0; for(int i=0;i<n;i++){ if(mv[i].p==0&&mv[i].couldCapture&&mv[i].got==0&&dec<0) dec=i; if(mv[i].p==0&&mv[i].safeBefore>0&&mv[i].gave>0&&mv[i].got==0) early=1; }
    int score=(dec>=0)*10+early*5; if(dec>=0) score+= (mv[dec].sc[0]+mv[dec].sc[1]<=4)?2:0;
    if(score>bs){bs=score;g5seed=seed;memcpy(g5,mv,sizeof(mv));n5=n;s5[0]=sc[0];s5[1]=sc[1];declineAt=dec;}
    if(score>=17) break; }
  randomMode=0;
  // g3: the same position as g5's decline, but Tavi eats everything first (then both perfect)
  Move g3[L]; int s3[2]; int n3=0; unsigned pre=0; int pre0=0,pre1=0;
  if(declineAt>=0){ for(int i=0;i<declineAt;i++){pre|=1u<<g5[i].line;} pre0=g5[declineAt-1].sc[0]; pre1=g5[declineAt-1].sc[1];
    startMask=pre; greedyOnce=1; n3=play(0,-1,-1,g3,s3); greedyOnce=0; startMask=0;
    // make a pure greedy-eat variant: Tavi captures while she can, then perfect
    unsigned m=pre; int p=0; n3=0; s3[0]=0;s3[1]=0; int eating=1;
    while(m!=FULL){ int l=-1; if(p==0&&eating){ for(int k=0;k<L;k++) if(!(m>>k&1)&&completed(m|(1u<<k),k)>0){l=k;break;} if(l<0) eating=0; }
      if(l<0) l=perfectMove(m,1);
      Move*x=&g3[n3++]; x->p=p;x->line=l;x->safeBefore=safeCount(m);x->couldCapture=canCapture(m);
      unsigned m2=m|(1u<<l); x->got=completed(m2,l); s3[p]+=x->got; x->sc[0]=pre0+s3[0];x->sc[1]=pre1+s3[1]; x->gave=x->got?0:giveaway(m2); m=m2; if(!x->got)p^=1; }
    s3[0]+=pre0; s3[1]+=pre1; }
  printf("{\n  \"board\": \"3x3 boxes, 16 dots; h r c = horizontal line above box row r (r 0..3), column c; v r c = vertical line left of box column c (c 0..3), row r\",\n");
  printf("  \"rule\": \"extra turn after completing a box\",\n  \"players\": \"p0 = Tavi (blue circle), p1 = Chalk (red cross)\",\n  \"g1_seed\": %d,\n",bestSeed);
  printGame("g1","tavi",g1,n1,s1); printf(",\n"); printGame("g5","chalk",g5,n5,s5); printf(",\n  \"g5_seed\": %u, \"g5_decline_move\": %d,\n",g5seed,declineAt+1); printGame("g3_eat_all_from_decline_position","tavi",g3,n3,s3); printf("\n}\n");
  return 0;
}
