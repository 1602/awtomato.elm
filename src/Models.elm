module Models exposing (..)

type alias Context =
    { id : String
    , name : String
    , selectors : List Selector
    }

type alias Entity =
    { primaryPick : Int
    , pickedElements : List Element
    , selector : String
    }

type alias Selector =
    { name : String
    , entity : Entity
    , isCollection : Bool
    , filter : SelectionFilter
    }

type alias Element =
    { x : Int
    , y : Int
    , distanceToTop : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    , elementId : Int
    , label : Maybe String
    , hasChildren : Bool
    }

type alias SelectionFilter =
    (String, String, String)

