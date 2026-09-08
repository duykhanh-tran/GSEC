export const VERBS_60121 = ['play','do','have','study'] as const
export const ITEMS_60121 = [
 {id:1,text:'On Monday, I ___ English and science.',key:'study',h1:'English and science are school subjects.',h2:'Use the verb for learning school subjects.',family:'study'},
 {id:2,text:'I ___ school lunch with my friends.',key:'have',h1:'School lunch is a meal.',h2:'Use the verb we normally use with meals.',family:'have'},
 {id:3,text:'After school, we ___ football.',key:'play',h1:'Football is a sport.',h2:'Use the verb we normally use with sports and games.',family:'play'},
 {id:4,text:'On Tuesday, I ___ history.',key:'study',h1:'History is a school subject.',h2:'Use the verb for learning school subjects.',family:'study'},
 {id:5,text:'In PE, we ___ exercise.',key:'do',h1:'Exercise is an activity.',h2:'Use the verb we use with exercise and homework.',family:'do'},
 {id:6,text:'In the Music Club, we ___ music.',key:'play',h1:'Think about performing music.',h2:'Use the verb we use with music here.',family:'play'},
 {id:7,text:'In the afternoon, we ___ two lessons.',key:'have',h1:'The two lessons are part of the school day.',h2:'Use the verb we normally use with lessons/classes.',family:'have'},
 {id:8,text:'At home, I ___ my homework.',key:'do',h1:'Homework is a task or activity.',h2:'Use the verb we use with homework.',family:'do'},
] as const
export const TRANSFER_60121={do:{q:'At home, I ___ yoga with my sister.',key:'do',hint:'Yoga is an activity.'},play:{q:'After school, we ___ volleyball.',key:'play',hint:'Volleyball is a sport.'},have:{q:'At noon, we ___ lunch at school.',key:'have',hint:'Lunch is a meal.'},study:{q:'On Wednesday, I ___ geography.',key:'study',hint:'Geography is a school subject.'}} as const
