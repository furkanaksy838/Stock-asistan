namespace ai;

using data from '../db/products';


type ChatTurn {
  role   : String;  
  content: String;
}

type ChatResponse {
  content : String;
}


service ProductService @(path:'/products') {
  entity Products as projection on data.Products;

}

service AIService @(path:'/ai') {
  @rest: { method: 'POST', path: 'chat' }
  action chat(message: String, history: many ChatTurn) returns ChatResponse;

 
}
